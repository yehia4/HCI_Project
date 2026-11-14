# LearnLens – AI-Assisted Personalized Assessment & Learning Gap Detection

LearnLens is a web-based educational assessment prototype designed for students in **Grades 1–5** and their teachers. It supports the exam assessment journey: students submit exam pages, teachers verify OCR-extracted answers, review AI-assisted grading suggestions, identify learning gaps, and send personalized feedback and practice activities.

The project was developed as part of **CSEN 909 – Human Computer Interaction (Winter 2026), German University in Cairo (GUC)**.

> **Core principle:** AI assists. Teachers verify. Teachers decide.

## Project Overview

LearnLens provides two main portals:

- **Student Portal:** Students can upload scanned exam papers, check their submission status, view confirmed grades and teacher feedback, complete assigned practice, and follow their progress.
- **Teacher Portal:** Teachers can review submissions, verify and correct extracted text, confirm or change suggested grades, review learning gaps and red flags, and prepare feedback and practice activities.

The prototype uses sample data and simulated assessment workflows to demonstrate the user experience. It is a frontend prototype, not a production assessment service.

## Main Features

### Student Portal

- **Unified sign-in:** The demo routes users to the student or teacher portal based on the demo username.
- **Student home:** Displays recent assessment information, progress, and notifications.
- **Exam upload:** Select the subject, exam name, and language, then add exam pages using the available upload/capture interface.
- **Page quality check:** Preview uploaded pages and replace unclear or blurry pages before submission.
- **Submission confirmation:** Confirms that an exam has been submitted.
- **Results hub:** View submitted exams and their statuses, grades, and teacher feedback.
- **Practice:** Complete practice activities assigned by the teacher.
- **Progress:** Review progress across assessments.

### Teacher Portal

- **Teacher dashboard:** View students, submissions, and work requiring attention.
- **OCR verification:** Compare the original exam page with extracted text, verify answers, correct OCR mistakes, or mark text as unreadable.
- **Grade review:** Review question-level AI score suggestions and accept, edit, or override them.
- **Learning-gap review:** Examine suggested learning gaps and supporting assessment evidence, then confirm, edit, or dismiss suggestions.
- **Red flags:** Review student performance flags and decide whether action is needed.
- **Feedback and practice:** Prepare student-facing feedback and review practice questions before sending them.

### Human-in-the-Loop Workflow

The teacher remains responsible for decisions. AI-generated suggestions are presented for teacher review; they are not treated as final grades or confirmed learning gaps automatically.

The main assessment journey is:

1. Student uploads an exam.
2. The system presents extracted text for teacher verification.
3. The teacher reviews and confirms the grading decisions.
4. The teacher reviews learning-gap and performance information.
5. The teacher prepares and sends feedback and, where appropriate, practice.
6. The student views the confirmed result and feedback.

## Demo Accounts

Use the following usernames on the sign-in screen:

| Portal | Username |
|---|---|
| Student | `omar.tarek` |
| Teacher | `nadia.farouk` |

For this prototype, enter any non-empty password. These are **demo-only credentials**; the sign-in flow is not production authentication.

## Tech Stack

- **React 19**
- **TypeScript**
- **Vite**
- **Tailwind CSS 4**
- **HTML and CSS**

The project is configured as a Vite application and uses `npm-lock.yaml` for dependency lockfile management.

## Getting Started

### Prerequisites

Install:

- [Node.js](https://nodejs.org/)
- [npm](https://npm.io/installation)

### 1. Clone the repository

```bash
git clone https://github.com/yehia4/HCI_Project.git
cd HCI_Project
```

### 2. Install dependencies

```bash
npm install
```

### 3. Start the development server

```bash
npm run dev
```

Vite will print a local development URL in the terminal. Open that URL in your browser.

## Logins
### 1. Teacher:
  nadia.farouk
### 2. Student:
  omar.tarek

Just type anything in the password field to enter (even 1 character works), there is no set password

### 4. Create a production build

```bash
npm build
```

### 5. Preview the production build locally

```bash
npm preview
```

## Project Structure

The main application files are organized as follows:

```text
HCI_Project/
├── public/                 # Public static assets
├── src/
│   ├── App.tsx             # Main React application, views and workflows
│   ├── data.ts             # Demo data, types and initial workflow state
│   ├── index.css           # Application styles
│   └── main.tsx            # React application entry point
├── .figma/                 # Figma Make project configuration
├── index.html              # HTML entry point
├── package.json            # Scripts and dependencies
├── npm-lock.yaml          # Locked dependency versions
├── tsconfig.json           # TypeScript configuration
└── vite.config.ts          # Vite configuration
```

## Supported Subjects and Languages

The prototype includes sample assessment data for multiple school subjects, including Mathematics, Physics, English, German, Arabic, and Art. Exam submissions support English and German as the configured exam-language options.

## Important Notes and Limitations

- This repository contains the **frontend prototype**.
- Demo student records, exam submissions, OCR results, grading suggestions, learning gaps, flags, and feedback are represented using sample application data.
- The prototype does not require a live LLM backend to demonstrate its workflows.
- The demo sign-in is for navigation and presentation only; it does not provide secure user authentication.
- Do not use real student records, personal information, or actual examination papers in this public demo repository.
- This project is an academic HCI prototype and is not intended for real educational grading or production use.

## Academic Context

**Course:** CSEN 909 – Human Computer Interaction  
**Semester:** Winter 2026  
**Institution:** German University in Cairo (GUC)  
**Project:** AI-Powered Personalized Assessment and Learning Gap Detection for Children

The project focuses on a child-friendly student experience and a teacher-controlled assessment workflow. Its design emphasizes explainable review steps, teacher confirmation, personalized feedback, and early identification of recurring learning difficulties.

## Repository

[https://github.com/yehia4/HCI_Project](https://github.com/yehia4/HCI_Project)

---

*LearnLens – See every learner more clearly.*
