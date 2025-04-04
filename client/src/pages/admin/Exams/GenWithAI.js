import React, { useState } from "react";
import { Button, Form, Input, Select, message } from "antd";
import { useNavigate } from "react-router-dom";
import { addExam, editExamById, addQuestionToExam, generateQuiz } from "../../../apicalls/exams";
import PageTitle from "../../../components/PageTitle";
import { useDispatch } from "react-redux";
import { ShowLoading, HideLoading } from "../../../redux/loaderSlice";

function GenWithAI() {
  const [form] = Form.useForm();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const onFinish = async (values) => {
    console.log("Form Values:", values);

    try {
      setLoading(true);
      dispatch(ShowLoading());

      // Step 1: Generate questions using API
      const data = await generateQuiz({
        text: values.text,
        difficulty: values.difficulty,
        numberOfQuestions: values.numberOfQuestions,
      });

      console.log("AI API Response:", data);

      if (!data || !Array.isArray(data.data) || data.data.length === 0) {
        throw new Error("AI failed to generate questions. Try again.");
      }

      // Step 2: Create a new exam
      const examPayload = {
        name: values.name || "Generated Quiz",
        duration: Number(values.duration),
        category: "Generated With AI",
        totalMarks: Number(values.totalMarks),
        passingMarks: Number(values.passingMarks),
        questions: [],
      };

      const examResponse = await addExam(examPayload);
      if (!examResponse.success) {
        throw new Error("Failed to create exam.");
      }

      const examId = examResponse.data._id;

      // Step 3: Save generated questions to the Question collection
      const questionIds = [];
      for (const question of data.data) {
        const questionPayload = {
          name: question.name,
          correctOption: question.correctOption,
          options: question.options,
          exam: examId,
        };

        const response = await addQuestionToExam(questionPayload);
        if (response.success) {
          questionIds.push(response.data._id);
        } else {
          throw new Error("Failed to save question.");
        }
      }

      // Step 4: Update the exam with the question IDs
      await editExamById({
        examId: examId,
        questions: questionIds,
      });

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
