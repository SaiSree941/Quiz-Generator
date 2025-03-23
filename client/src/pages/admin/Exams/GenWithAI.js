import React, { useState } from "react";
import { Button, Form, Input, Select, message } from "antd";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { addExam } from "../../../apicalls/exams";
import PageTitle from "../../../components/PageTitle";
import { useDispatch } from "react-redux";
import { ShowLoading, HideLoading } from "../../../redux/loaderSlice";
// import { Question } from "../../../models/questionModel"; // Adjust the path as needed

function GenWithAI() {
  // const Question = require("../models/questionModel");
  const [form] = Form.useForm();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const onFinish = async (values) => {
    console.log("Form Values:", values);
  
    try {
      setLoading(true);
      dispatch(ShowLoading());
  
      // Step 1: Generate questions using Gemini API
      const { data } = await axios.post(
        "http://localhost:3000/api/exams/generate-quiz",
        {
          text: values.text,
          difficulty: values.difficulty,
          numberOfQuestions: values.numberOfQuestions,
        },
        {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        }
      );
  
      console.log("AI API Response:", data);
  
      if (!data || !Array.isArray(data.data) || data.data.length === 0) {
        throw new Error("AI failed to generate questions. Try again.");
      }
  
      // Step 2: Create a new exam
      const examPayload = {
        name: values.name || "Generated Quiz",
        duration: Number(values.duration), // Convert to number
        category: values.text,
        totalMarks: Number(values.totalMarks), // Convert to number
        passingMarks: Number(values.passingMarks), // Convert to number
        questions: [], // Initially empty, will be populated with question IDs
      };
  
      const examResponse = await addExam(examPayload);
      if (!examResponse.success) {
        throw new Error("Failed to create exam.");
      }
  
      const examId = examResponse.data._id; // Get the ID of the newly created exam
  
      // Step 3: Save generated questions to the Question collection
      const questionIds = [];
      for (const question of data.data) {
        const questionPayload = {
          name: question.name,
          correctOption: question.correctOption,
          options: question.options,
          exam: examId, // Link the question to the newly created exam
        };
  
        // Save each question to the Question collection
        const response = await axios.post(
          "http://localhost:3000/api/exams/add-question-to-exam",
          questionPayload,
          {
            headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
          }
        );
  
        if (response.data.success) {
          questionIds.push(response.data.data._id); // Save the question ID
        } else {
          throw new Error("Failed to save question.");
        }
      }
  
      // Step 4: Update the exam with the question IDs
      await axios.post(
        "http://localhost:3000/api/exams/edit-exam-by-id",
        {
          examId: examId,
          questions: questionIds, // Update the exam with the question IDs
        },
        {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        }
      );
  
      // Step 5: Notify the user
      message.success("Quiz added successfully!");
      navigate("/admin/exams");
    } catch (error) {
      console.error("Error:", error);
      message.error(error.message || "Something went wrong.");
    } finally {
      setLoading(false);
      dispatch(HideLoading());
    }
  };

  return (
    <div>
      <PageTitle title="Generate Quiz with AI" />
      <Form form={form} layout="vertical" onFinish={onFinish}>
        <Form.Item label="Enter Text for AI" name="text" rules={[{ required: true }]}>
          <Input.TextArea rows={6} placeholder="Paste text here..." />
        </Form.Item>
        <Form.Item label="Quiz Name" name="name" rules={[{ required: true }]}>
          <Input placeholder="Enter quiz name" />
        </Form.Item>
        <Form.Item label="Difficulty" name="difficulty">
          <Select>
            <Select.Option value="easy">Easy</Select.Option>
            <Select.Option value="medium">Medium</Select.Option>
            <Select.Option value="hard">Hard</Select.Option>
          </Select>
        </Form.Item>
        <Form.Item label="Total Marks" name="totalMarks">
          <input type="number" />
        </Form.Item>
        <Form.Item label="Passing Marks" name="passingMarks">
          <input type="number" />
        </Form.Item>
        <Form.Item label="Number of Questions" name="numberOfQuestions" rules={[{ required: true }]}>
          <Input type="number" placeholder="Enter number of questions" />
        </Form.Item>
        <Form.Item label="Exam Duration" name="duration">
          <input type="number" />
        </Form.Item>
        <Button type="primary" htmlType="submit" loading={loading}>
          Generate & Save Quiz
        </Button>
      </Form>
    </div>
  );
}

export default GenWithAI;