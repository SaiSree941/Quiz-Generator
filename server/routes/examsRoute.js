const express = require("express");
const router = express.Router();
const Exam = require("../models/examModel");
const Question = require("../models/questionModel");
const authMiddleware = require("../middlewares/authMiddleware");
const {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} = require("@google/generative-ai");

// Polyfill fetch and Headers for Node.js
const fetch = require("node-fetch");
const { Headers } = require("node-fetch");
global.fetch = fetch; // Polyfill fetch globally
global.Headers = Headers; // Polyfill Headers globally

require("dotenv").config();

// Initialize Gemini API
const apiKey = "your_api_key_here";//process.env.GEMINI_API_KEY; // Ensure this is set in your .env file
if (!apiKey) {
  console.error("Error: GEMINI_API_KEY is not set in the .env file.");
  process.exit(1); // Exit the application if the API key is missing
}
const genAI = new GoogleGenerativeAI(apiKey);

const model = genAI.getGenerativeModel({
  model: "gemini-2.0-flash",
});

const generationConfig = {
  temperature: 1,
  topP: 0.95,
  topK: 40,
  maxOutputTokens: 8192,
  responseMimeType: "text/plain",
};

// Generate Quiz with Gemini API
router.post("/generate-quiz", authMiddleware, async (req, res) => {
  try {
    const { text, difficulty, numberOfQuestions } = req.body;

    // Validate request payload
    if (!text || !numberOfQuestions) {
      return res.status(400).send({
        message: "Text and Number of Questions are required",
        success: false,
      });
    }

    // Gemini API prompt
    const prompt = `Generate ${numberOfQuestions} ${difficulty || "medium"}-level multiple-choice quiz questions based on the following text:
    "${text}"
    Format each question EXACTLY as follows:
    {
      "name": "<question text>",
      "options": {
        "A": "<option A>",
        "B": "<option B>",
        "C": "<option C>",
        "D": "<option D>"
      },
      "correctOption": "<correct option letter (A, B, C, or D)>"
    }
    Ensure that:
    1. Each question has exactly 4 options (A, B, C, D).
    2. Only one option is correct for each question.
    3. The output is a valid JSON array of question objects.`;

    console.log("Prompt:", prompt);

    // Start a chat session
    const chatSession = model.startChat({
      generationConfig,
      history: [], // No history needed for this use case
    });

    // Send the prompt to the model
    const result = await chatSession.sendMessage(prompt);
    const generatedText = result.response.text();
    console.log("Generated Text:", generatedText);

    // Parse the generated text into structured questions
    const generatedQuestions = parseGeneratedText(generatedText);

    if (!Array.isArray(generatedQuestions) || generatedQuestions.length === 0) {
      return res.status(400).send({
        message: "Failed to generate valid questions.",
        success: false,
      });
    }

    res.send({
      message: "Quiz questions generated successfully",
      success: true,
      data: generatedQuestions,
    });
  } catch (error) {
    console.error("Error generating quiz:", error);
    res.status(500).send({
      message: "Error generating quiz",
      success: false,
      data: error.message,
    });
  }
});

// Function to parse generated text into structured JSON
function parseGeneratedText(text) {
  try {
    // Remove any extra text or markdown formatting
    const cleanedText = text.replace(/```json|```/g, "").trim();

    // Parse the cleaned text as JSON
    const questions = JSON.parse(cleanedText);

    // Validate the parsed questions
    if (!Array.isArray(questions)) {
      throw new Error("Generated text is not a valid JSON array.");
    }

    // Validate each question object
    questions.forEach((question) => {
      if (
        !question.name ||
        !question.options ||
        !question.correctOption
      ) {
        throw new Error("Generated questions are missing required fields.");
      }
    });

    return questions;
  } catch (error) {
    console.error("Error parsing generated text:", error);
    throw new Error("Failed to parse generated questions. Please check the prompt and try again.");
  }
}

router.post("/add", authMiddleware, async (req, res) => {
  try {
    console.log("Request Body:", req.body); // Debug: Log the request body

    // Check if exam already exists
    const examExists = await Exam.findOne({ name: req.body.name });
    if (examExists) {
      console.log("Exam already exists:", examExists); // Debug: Log existing exam
      return res.status(200).send({
        message: "Exam already exists",
        success: false,
      });
    }

    // Create a new exam
    req.body.questions = []; // Initialize questions as an empty array
    const newExam = new Exam(req.body);
    await newExam.save();

    console.log("Exam created:", newExam); // Debug: Log the created exam

    res.send({
      message: "Exam added successfully",
      success: true,
      data: newExam, // Return the created exam, including its _id
    });
  } catch (error) {
    console.error("Error creating exam:", error); // Debug: Log the error
    res.status(500).send({
      message: error.message,
      data: error,
      success: false,
    });
  }
});

// get all exams
router.post("/get-all-exams", authMiddleware, async (req, res) => {
  try {
    const exams = await Exam.find({});
    res.send({
      message: "Exams fetched successfully",
      data: exams,
      success: true,
    });
  } catch (error) {
    res.status(500).send({
      message: error.message,
      data: error,
      success: false,
    });
  }
});

// get exam by id
router.post("/get-exam-by-id", authMiddleware, async (req, res) => {
  try {
    const exam = await Exam.findById(req.body.examId).populate("questions");
    res.send({
      message: "Exam fetched successfully",
      data: exam,
      success: true,
    });
  } catch (error) {
    res.status(500).send({
      message: error.message,
      data: error,
      success: false,
    });
  }
});

// edit exam by id
router.post("/edit-exam-by-id", authMiddleware, async (req, res) => {
  try {
    await Exam.findByIdAndUpdate(req.body.examId, req.body);
    res.send({
      message: "Exam edited successfully",
      success: true,
    });
  } catch (error) {
    res.status(500).send({
      message: error.message,
      data: error,
      success: false,
    });
  }
});

// delete exam by id
router.post("/delete-exam-by-id", authMiddleware, async (req, res) => {
  try {
    await Exam.findByIdAndDelete(req.body.examId);
    res.send({
      message: "Exam deleted successfully",
      success: true,
    });
  } catch (error) {
    res.status(500).send({
      message: error.message,
      data: error,
      success: false,
    });
  }
});

// add question to exam

router.post("/add-question-to-exam", authMiddleware, async (req, res) => {
  try {
    console.log("Request Body:", req.body); // Debug: Log the request body

    // Validate request body
    const { name, correctOption, options, exam } = req.body;

    if (!name || !correctOption || !options || !exam) {
      console.error("Missing required fields"); // Debug: Log missing fields
      return res.status(400).send({
        message: "Missing required fields: name, correctOption, options, or exam",
        success: false,
      });
    }

    // Add question to Questions collection
    const newQuestion = new Question({ name, correctOption, options, exam });
    const question = await newQuestion.save();
    console.log("Question saved:", question); // Debug: Log the saved question

    // Add question to exam
    const examToUpdate = await Exam.findById(exam);
    if (!examToUpdate) {
      console.error("Exam not found:", exam); // Debug: Log invalid exam ID
      return res.status(404).send({
        message: "Exam not found",
        success: false,
      });
    }

    examToUpdate.questions.push(question._id);
    await examToUpdate.save();
    console.log("Exam updated:", examToUpdate); // Debug: Log the updated exam

    // Send success response
    res.send({
      message: "Question added successfully",
      success: true,
      data: question, // Include the saved question in the response
    });
  } catch (error) {
    console.error("Error adding question to exam:", error); // Debug: Log the error
    res.status(500).send({
      message: error.message,
      data: error,
      success: false,
    });
  }
});

// edit question in exam
router.post("/edit-question-in-exam", authMiddleware, async (req, res) => {
  try {
    // edit question in Questions collection
    await Question.findByIdAndUpdate(req.body.questionId, req.body);
    res.send({
      message: "Question edited successfully",
      success: true,
    });
  } catch (error) {
    res.status(500).send({
      message: error.message,
      data: error,
      success: false,
    });
  }
});


// delete question in exam
router.post("/delete-question-in-exam", authMiddleware, async (req, res) => {
     try {
        // delete question in Questions collection
        await Question.findByIdAndDelete(req.body.questionId);

        // delete question in exam
        const exam = await Exam.findById(req.body.examId);
        exam.questions = exam.questions.filter(
          (question) => question._id != req.body.questionId
        );
        await exam.save();
        res.send({
          message: "Question deleted successfully",
          success: true,
        });
     } catch (error) {
      
     }
});

module.exports = router;