export type ExamStatus = "Teacher checking" | "Graded";

export type SubmissionPage = {
  id: string;
  name: string;
  previewUrl?: string;
  quality: "clear" | "blurry";
  retaken?: boolean;
};

export type ExamSubmission = {
  id: string;
  studentId: string;
  examName: string;
  customExamName: string;
  subject: string;
  language: "English" | "German";
  pages: SubmissionPage[];
  status: ExamStatus;
  submitted: boolean;
  submittedAt?: string;
  reference: string;
  grade?: number;
};

export const initialExamSubmission: ExamSubmission = {
  id: "draft",
  studentId: "omar",
  examName: "Comparing Fractions Quiz – Unit 4",
  customExamName: "",
  subject: "Mathematics",
  language: "English",
  pages: [],
  status: "Teacher checking",
  submitted: false,
  reference: "LL-OM-250518-104",
};

const storedPages = (examId: string, count: number): SubmissionPage[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `${examId}-page-${index + 1}`,
    name: `Page ${index + 1}`,
    quality: "clear",
  }));

export const initialStudentSubmissions: ExamSubmission[] = [
  {
    id: "omar-fractions-unit-3",
    studentId: "omar",
    examName: "Fractions Test – Unit 3",
    customExamName: "",
    subject: "Mathematics",
    language: "English",
    pages: storedPages("omar-fractions-unit-3", 3),
    status: "Graded",
    submitted: true,
    submittedAt: "May 14, 2025",
    reference: "LL-OM-250514-052",
    grade: 52,
  },
  {
    id: "omar-forces-motion",
    studentId: "omar",
    examName: "Forces and Motion",
    customExamName: "",
    subject: "Physics",
    language: "English",
    pages: storedPages("omar-forces-motion", 4),
    status: "Teacher checking",
    submitted: true,
    submittedAt: "May 16, 2025",
    reference: "LL-OM-250516-081",
  },
  {
    id: "omar-mathematik-brueche",
    studentId: "omar",
    examName: "Mathematik – Brüche",
    customExamName: "",
    subject: "Mathematics",
    language: "German",
    pages: storedPages("omar-mathematik-brueche", 3),
    status: "Teacher checking",
    submitted: true,
    submittedAt: "May 17, 2025",
    reference: "LL-OM-250517-093",
  },
  {
    id: "omar-word-problems",
    studentId: "omar",
    examName: "Word Problems Check",
    customExamName: "",
    subject: "Mathematics",
    language: "English",
    pages: storedPages("omar-word-problems", 2),
    status: "Teacher checking",
    submitted: true,
    submittedAt: "May 18, 2025",
    reference: "LL-OM-250518-101",
  },
];

export type OCRAnswer = {
  id: string;
  page: number;
  question: string;
  /** What the student actually wrote on the paper (never changes). */
  handwritten: string;
  /** What the AI originally read from the paper. */
  aiReading: string;
  /** Current text, including any teacher correction. This is what gets graded. */
  extractedText: string;
  confidence: number;
  status: "pending" | "verified" | "corrected" | "unreadable";
  /** Hard-to-read handwriting on the paper preview. */
  messy?: boolean;
  rescanRequested?: boolean;
};

export type OCRTask = {
  id: string;
  studentId: string;
  studentName: string;
  initials: string;
  className: string;
  title: string;
  subject: string;
  language: "English" | "German";
  submittedAt: string;
  pages: number;
  reference: string;
  /** "reading" = the AI is still extracting text, so the teacher cannot verify yet. */
  readiness: "ready" | "reading";
  answers: OCRAnswer[];
  completed: boolean;
};

export type GradeQuestion = {
  id: string;
  question: string;
  studentAnswer: string;
  expectedAnswer: string;
  suggestedScore: number;
  maxScore: number;
  rationale: string;
  finalScore?: number;
  decision?: "accepted" | "edited" | "overridden";
  teacherNote?: string;
  /** Links this question to the OCR answer it is graded from. */
  ocrId?: string;
  /** The teacher marked the OCR text unreadable, so this must be graded from the paper. */
  ocrUnreadable?: boolean;
};

export type GradeTask = {
  id: string;
  studentId: string;
  studentName: string;
  initials: string;
  className: string;
  title: string;
  subject: string;
  language: "English" | "German";
  submittedAt: string;
  /** OCR text has been verified by the teacher, so AI grading is available. */
  ocrDone: boolean;
  questions: GradeQuestion[];
  finalized: boolean;
  finalScore?: number;
};

export type GapEvidence = {
  id: string;
  examId: string;
  question: string;
  studentAnswer: string;
  expectedAnswer: string;
  finding: string;
  /** Evidence from the exam being reviewed now: the answer is read live from Grade Review. */
  gradeQuestionId?: string;
};

export type GapTimelineExam = {
  examId: string;
  title: string;
  date: string;
  /** Leave empty for the current exam: the finalized grade is used. */
  score?: number;
  current?: boolean;
  relation: "pattern" | "unrelated" | "mixed";
};

export type LearningGap = {
  id: string;
  studentId: string;
  studentName: string;
  initials: string;
  className: string;
  grade: string;
  subject: string;
  topic: string;
  title: string;
  description: string;
  /** Original AI wording, so edits can be detected and reset. */
  aiTitle: string;
  aiDescription: string;
  confidence: number;
  confidenceReason: string;
  status: "suggested" | "confirmed" | "dismissed";
  teacherObservation: string;
  dismissReason?: string;
  timeline: GapTimelineExam[];
  evidence: GapEvidence[];
  /** What the student got right on related questions – shown so the teacher sees both sides. */
  counterEvidence: { examId: string; text: string }[];
  /** Grade task that must be finalized before the teacher decides. */
  gradeTaskId: string;
};

export type TeacherWorkflow = {
  exam: {
    id: string;
    studentId: string;
    studentName: string;
    className: string;
    grade: string;
    title: string;
    subject: string;
    language: "English" | "German";
    submittedAt: string;
    pages: number;
    reference: string;
  };
  ocrAnswers: OCRAnswer[];
  ocrCompleted: boolean;
  gradeQuestions: GradeQuestion[];
  gradeFinalized: boolean;
  finalScore?: number;
  gap: LearningGap;
  feedback: FeedbackDraft;
};

export type FeedbackDraft = {
  message: string;
  /** AI draft used when the learning gap is confirmed (with targeted practice). */
  aiMessage: string;
  /** AI draft used when there is no confirmed gap (feedback only). */
  aiMessageNoGap: string;
  sendPractice: boolean;
  practiceApproved: boolean;
  sent: boolean;
  questions: PracticeQuestion[];
};

export type PracticeQuestion = {
  id: string;
  text: string;
  /** auto = LearnLens checks the answer · teacher = Ms. Nadia checks it herself */
  check: "auto" | "teacher";
  /** The correct answer (for teacher-check questions: a model answer for Ms. Nadia). */
  answer: string;
  /** Other ways of writing the same correct answer. */
  accepted: string[];
  /** Who provided the answer: suggested by AI, or written/confirmed by the teacher. */
  answerSource: "ai" | "teacher";
  hint?: string;
  reason?: string;
};

export type FeedbackTask = FeedbackDraft & {
  /** Same id as the grade task this feedback belongs to. */
  id: string;
  studentId: string;
};

export const initialTeacherWorkflow: TeacherWorkflow = {
  exam: {
    id: "teacher-omar-fractions-unit-4",
    studentId: "omar",
    studentName: "Omar Tarek",
    className: "Grade 4-B",
    grade: "Grade 4",
    title: "Comparing Fractions Quiz – Unit 4",
    subject: "Mathematics",
    language: "English",
    submittedAt: "May 19, 2025",
    pages: 3,
    reference: "LL-OM-250519-105",
  },
  ocrAnswers: [
    {
      id: "ocr-q1",
      page: 1,
      question: "1. Circle the larger fraction: 2/3 or 3/5.",
      handwritten: "3/5 is larger because 5 is bigger than 3.",
      aiReading: "3/5 is larger because 5 is bigger than 3.",
      extractedText: "3/5 is larger because 5 is bigger than 3.",
      confidence: 98,
      status: "pending",
    },
    {
      id: "ocr-q2",
      page: 1,
      question: "2. Compare 3/4 and 5/8 using >, < or =.",
      handwritten: "3/4 < 5/8",
      aiReading: "3/4 < 5/8",
      extractedText: "3/4 < 5/8",
      confidence: 91,
      status: "pending",
    },
    {
      id: "ocr-q3",
      page: 2,
      question: "3. Put 1/2, 2/3 and 3/8 in order from least to greatest.",
      handwritten: "3/8, 1/2, 2/3",
      aiReading: "3/8, 1/2, 2/5",
      extractedText: "3/8, 1/2, 2/5",
      confidence: 62,
      status: "pending",
      messy: true,
    },
    {
      id: "ocr-q4",
      page: 2,
      question: "4. Explain how you compare fractions.",
      handwritten: "I look at the botom number. The biger botom number is biger.",
      aiReading: "I look at the botom numler. The biger botom numler is biger.",
      extractedText: "I look at the botom numler. The biger botom numler is biger.",
      confidence: 58,
      status: "pending",
      messy: true,
    },
    {
      id: "ocr-q5",
      page: 3,
      question: "5. Sara ate 2/6 of a pizza and Omar ate 1/3. Who ate more?",
      handwritten: "They ate the same amount.",
      aiReading: "They ate the same amount.",
      extractedText: "They ate the same amount.",
      confidence: 96,
      status: "pending",
    },
  ],
  ocrCompleted: false,
  gradeQuestions: [
    {
      id: "grade-q1",
      ocrId: "ocr-q1",
      question: "Circle the larger fraction: 2/3 or 3/5.",
      studentAnswer: "3/5 is larger because 5 is bigger than 3.",
      expectedAnswer: "2/3 is larger. Compare using a common denominator or relative value.",
      suggestedScore: 0,
      maxScore: 2,
      rationale: "The chosen fraction is wrong, and the reason compares denominators only.",
    },
    {
      id: "grade-q2",
      ocrId: "ocr-q2",
      question: "Compare 3/4 and 5/8 using >, < or =.",
      studentAnswer: "3/4 < 5/8",
      expectedAnswer: "3/4 > 5/8",
      suggestedScore: 0,
      maxScore: 2,
      rationale: "The comparison symbol is reversed.",
    },
    {
      id: "grade-q3",
      ocrId: "ocr-q3",
      question: "Put 1/2, 2/3 and 3/8 in order from least to greatest.",
      studentAnswer: "3/8, 1/2, 2/3",
      expectedAnswer: "3/8, 1/2, 2/3",
      suggestedScore: 3,
      maxScore: 3,
      rationale: "The fractions are ordered correctly.",
    },
    {
      id: "grade-q4",
      ocrId: "ocr-q4",
      question: "Explain how you compare fractions.",
      studentAnswer: "I look at the botom number. The biger botom number is biger.",
      expectedAnswer:
        "Use a common denominator (or compare to 1/2). A bigger denominator means smaller parts.",
      suggestedScore: 0,
      maxScore: 2,
      rationale: "The explanation describes comparing denominators only, which is not correct.",
    },
    {
      id: "grade-q5",
      ocrId: "ocr-q5",
      question: "Sara ate 2/6 of a pizza and Omar ate 1/3. Who ate more?",
      studentAnswer: "They ate the same amount.",
      expectedAnswer: "They ate the same amount (2/6 = 1/3).",
      suggestedScore: 2,
      maxScore: 3,
      rationale:
        "The conclusion is correct, but no working is shown. One mark removed for the missing explanation.",
    },
  ],
  gradeFinalized: false,
  gap: {
    id: "gap-omar-fractions",
    studentId: "omar",
    studentName: "Omar Tarek",
    initials: "OT",
    className: "Grade 4-B",
    grade: "Grade 4",
    subject: "Mathematics",
    topic: "Comparing fractions",
    title: "Compares fractions by looking only at the denominator",
    description:
      "Omar treats the fraction with the bigger bottom number as the bigger fraction. He does not yet think about the size of the parts or use a common denominator.",
    aiTitle: "Compares fractions by looking only at the denominator",
    aiDescription:
      "Omar treats the fraction with the bigger bottom number as the bigger fraction. He does not yet think about the size of the parts or use a common denominator.",
    confidence: 89,
    confidenceReason:
      "The same error appears in 5 questions across 3 exams, and Omar describes the rule in his own words. One related question was answered correctly.",
    status: "suggested",
    teacherObservation: "",
    gradeTaskId: "teacher-omar-fractions-unit-4",
    timeline: [
      {
        examId: "multiplication",
        title: "Multiplication Review",
        date: "Apr 8",
        score: 58,
        relation: "unrelated",
      },
      {
        examId: "word-problems",
        title: "Word Problems Check",
        date: "Apr 28",
        score: 55,
        relation: "pattern",
      },
      {
        examId: "fractions-3",
        title: "Fractions Test – Unit 3",
        date: "May 14",
        score: 52,
        relation: "pattern",
      },
      {
        examId: "teacher-omar-fractions-unit-4",
        title: "Comparing Fractions Quiz – Unit 4",
        date: "May 19",
        current: true,
        relation: "pattern",
      },
    ],
    evidence: [
      {
        id: "ev-1",
        examId: "word-problems",
        question: "Mona ate 1/4 of a cake and Ali ate 1/3. Who ate more?",
        studentAnswer: "Mona, because 4 is bigger than 3.",
        expectedAnswer: "Ali (1/3 > 1/4)",
        finding: "Chose the fraction with the bigger denominator.",
      },
      {
        id: "ev-2",
        examId: "fractions-3",
        question: "Order 2/5, 1/2 and 3/4 from least to greatest.",
        studentAnswer: "1/2, 3/4, 2/5",
        expectedAnswer: "2/5, 1/2, 3/4",
        finding: "Ordered the fractions by the size of the denominator.",
      },
      {
        id: "ev-3",
        examId: "teacher-omar-fractions-unit-4",
        gradeQuestionId: "grade-q1",
        question: "Circle the larger fraction: 2/3 or 3/5.",
        studentAnswer: "",
        expectedAnswer: "2/3",
        finding: "Chose 3/5 because 5 is bigger than 3.",
      },
      {
        id: "ev-4",
        examId: "teacher-omar-fractions-unit-4",
        gradeQuestionId: "grade-q2",
        question: "Compare 3/4 and 5/8 using >, < or =.",
        studentAnswer: "",
        expectedAnswer: "3/4 > 5/8",
        finding: "Reversed the comparison because 8 is bigger than 4.",
      },
      {
        id: "ev-5",
        examId: "teacher-omar-fractions-unit-4",
        gradeQuestionId: "grade-q4",
        question: "Explain how you compare fractions.",
        studentAnswer: "",
        expectedAnswer: "Use a common denominator; a bigger denominator means smaller parts.",
        finding: "Describes the denominator-only rule in his own words.",
      },
    ],
    counterEvidence: [
      {
        examId: "teacher-omar-fractions-unit-4",
        text: "Unit 4, Q3: ordered 3/8, 1/2 and 2/3 correctly. He may already compare fractions to 1/2.",
      },
    ],
  },
  feedback: {
    message:
      "Good work on halves, Omar! Next time, draw the fraction bars before you compare. It really helps.",
    aiMessage:
      "Good work on halves, Omar! Next time, draw the fraction bars before you compare. It really helps.",
    aiMessageNoGap:
      "Good work on halves, Omar! Next time, draw the fraction bars before you compare. It really helps.",
    sendPractice: true,
    practiceApproved: false,
    sent: false,
    questions: [
      {
        id: "pq-1",
        text: "Which is larger: 2/3 or 3/5?",
        check: "auto",
        answer: "2/3",
        accepted: ["2/3 is larger", "two thirds", "2/3 > 3/5"],
        answerSource: "ai",
        hint: "Think about how close each fraction is to one whole.",
        reason: "Two thirds is a little more than three fifths.",
      },
      {
        id: "pq-2",
        text: "Use >, < or = to compare 4/5 and 7/10.",
        check: "auto",
        answer: "4/5 > 7/10",
        accepted: ["7/10 < 4/5"],
        answerSource: "ai",
        hint: "Try writing both fractions with a denominator of 10.",
        reason: "Four fifths is 8/10, so it is larger than 7/10.",
      },
      {
        id: "pq-3",
        text: "Order 1/3, 3/4 and 2/5 from least to greatest.",
        check: "auto",
        answer: "1/3, 2/5, 3/4",
        accepted: ["1/3 < 2/5 < 3/4", "1/3 2/5 3/4"],
        answerSource: "ai",
        hint: "Compare each fraction with one half.",
        reason: "One third is smallest, then two fifths, then three quarters.",
      },
      {
        id: "pq-4",
        text: "Mina ate 3/8 of a cake and Sam ate 1/2. Who ate more?",
        check: "auto",
        answer: "Sam",
        accepted: ["Sam ate more", "Sam did"],
        answerSource: "ai",
        hint: "Write one half as eighths.",
        reason: "One half is 4/8, which is more than 3/8.",
      },
      {
        id: "pq-5",
        text: "Draw a model to compare 2/6 and 1/4. Which is larger?",
        check: "teacher",
        answer: "2/6 is larger (2/6 = 1/3, and 1/3 > 1/4).",
        accepted: [],
        answerSource: "ai",
      },
    ],
  },
};

export const initialExtraOcrTasks: OCRTask[] = [
  {
    id: "nour-german",
    studentId: "nour",
    studentName: "Nour Emad",
    initials: "NE",
    className: "Grade 3-C",
    title: "Mathematik – Brüche",
    subject: "Mathematics",
    language: "German",
    submittedAt: "May 15, 2025",
    pages: 2,
    reference: "LL-NE-250515-061",
    readiness: "ready",
    completed: false,
    answers: [
      {
        id: "nour-q1",
        page: 1,
        question: "1. Welcher Bruch ist größer: 1/2 oder 1/4?",
        handwritten: "1/2 ist größer.",
        aiReading: "1/2 ist größer.",
        extractedText: "1/2 ist größer.",
        confidence: 97,
        status: "pending",
      },
      {
        id: "nour-q2",
        page: 1,
        question: "2. Schreibe 2/4 einfacher.",
        handwritten: "2/4 = 1/2",
        aiReading: "2/4 = 1/2",
        extractedText: "2/4 = 1/2",
        confidence: 93,
        status: "pending",
      },
      {
        id: "nour-q3",
        page: 2,
        question: "3. Ordne vom kleinsten zum größten: 1/3, 1/6, 1/2.",
        handwritten: "1/6, 1/3, 1/2",
        aiReading: "1/6, 1/8, 1/2",
        extractedText: "1/6, 1/8, 1/2",
        confidence: 64,
        status: "pending",
        messy: true,
      },
    ],
  },
  {
    id: "yehia-multiplication",
    studentId: "yehia",
    studentName: "Yehia Wael",
    initials: "YW",
    className: "Grade 3-B",
    title: "Multiplication Facts",
    subject: "Mathematics",
    language: "English",
    submittedAt: "May 16, 2025",
    pages: 2,
    reference: "LL-YW-250516-033",
    readiness: "ready",
    completed: false,
    answers: [
      {
        id: "yehia-q1",
        page: 1,
        question: "1. 6 × 4 = ?",
        handwritten: "24",
        aiReading: "24",
        extractedText: "24",
        confidence: 97,
        status: "pending",
      },
      {
        id: "yehia-q2",
        page: 1,
        question: "2. 7 × 8 = ?",
        handwritten: "56",
        aiReading: "36",
        extractedText: "36",
        confidence: 61,
        status: "pending",
        messy: true,
      },
      {
        id: "yehia-q3",
        page: 2,
        question: "3. A class has 3 rows of 9 chairs. How many chairs?",
        handwritten: "27 chairs",
        aiReading: "27 chairs",
        extractedText: "27 chairs",
        confidence: 94,
        status: "pending",
      },
    ],
  },
  {
    id: "adam-fractions",
    studentId: "adam",
    studentName: "Adam Samir",
    initials: "AS",
    className: "Grade 4-B",
    title: "Equivalent Fractions",
    subject: "Mathematics",
    language: "English",
    submittedAt: "May 14, 2025",
    pages: 2,
    reference: "LL-AS-250514-047",
    readiness: "ready",
    completed: false,
    answers: [
      {
        id: "adam-q1",
        page: 1,
        question: "1. Write a fraction equal to 1/2.",
        handwritten: "2/4",
        aiReading: "2/4",
        extractedText: "2/4",
        confidence: 95,
        status: "pending",
      },
      {
        id: "adam-q2",
        page: 1,
        question: "2. Is 3/6 equal to 1/2? Explain.",
        handwritten: "yes because 3 is half of 6",
        aiReading: "yes because 3 is half of 8",
        extractedText: "yes because 3 is half of 8",
        confidence: 66,
        status: "pending",
        messy: true,
      },
      {
        id: "adam-q3",
        page: 2,
        question: "3. Fill in the box: 2/3 = ?/6",
        handwritten: "4",
        aiReading: "4",
        extractedText: "4",
        confidence: 92,
        status: "pending",
      },
    ],
  },
];

export const initialExtraGradeTasks: GradeTask[] = [
  {
    id: "laila-addition",
    studentId: "laila",
    studentName: "Laila Hany",
    initials: "LH",
    className: "Grade 3-A",
    title: "Three-digit Addition",
    subject: "Mathematics",
    language: "English",
    submittedAt: "May 15, 2025",
    ocrDone: true,
    finalized: false,
    questions: [
      {
        id: "laila-q1",
        question: "345 + 232 = ?",
        studentAnswer: "577",
        expectedAnswer: "577",
        suggestedScore: 2,
        maxScore: 2,
        rationale: "Correct.",
      },
      {
        id: "laila-q2",
        question: "468 + 157 = ?",
        studentAnswer: "515",
        expectedAnswer: "625",
        suggestedScore: 0,
        maxScore: 2,
        rationale: "The student did not carry when regrouping (wrote 515 instead of 625).",
      },
      {
        id: "laila-q3",
        question:
          "A shop sold 276 apples on Monday and 189 on Tuesday. How many apples did it sell in total?",
        studentAnswer: "455 apples",
        expectedAnswer: "465 apples",
        suggestedScore: 2,
        maxScore: 3,
        rationale: "Correct method, but a slip in the tens column gives 455 instead of 465.",
      },
      {
        id: "laila-q4",
        question: "509 + 384 = ?",
        studentAnswer: "893",
        expectedAnswer: "893",
        suggestedScore: 2,
        maxScore: 2,
        rationale: "Correct.",
      },
    ],
  },
  {
    id: "fawzy-word-problems",
    studentId: "fawzy",
    studentName: "Fawzy Ibrahim",
    initials: "FI",
    className: "Grade 3-B",
    title: "Word Problems – Unit 2",
    subject: "Mathematics",
    language: "English",
    submittedAt: "May 16, 2025",
    ocrDone: true,
    finalized: false,
    questions: [
      {
        id: "fawzy-q1",
        question: "Ali has 24 stickers and gives away 9. How many are left?",
        studentAnswer: "15",
        expectedAnswer: "15",
        suggestedScore: 2,
        maxScore: 2,
        rationale: "Correct.",
      },
      {
        id: "fawzy-q2",
        question: "A box holds 6 eggs. How many eggs are in 4 boxes?",
        studentAnswer: "10",
        expectedAnswer: "24",
        suggestedScore: 0,
        maxScore: 2,
        rationale: "Added 6 + 4 instead of multiplying 6 × 4.",
      },
      {
        id: "fawzy-q3",
        question: "Sara reads 12 pages a day. How many pages does she read in 3 days?",
        studentAnswer: "15 pages",
        expectedAnswer: "36 pages",
        suggestedScore: 0,
        maxScore: 3,
        rationale: "Added 12 + 3 instead of multiplying 12 × 3.",
      },
      {
        id: "fawzy-q4",
        question: "30 children are put into 5 equal groups. How many are in each group?",
        studentAnswer: "6",
        expectedAnswer: "6",
        suggestedScore: 2,
        maxScore: 2,
        rationale: "Correct.",
      },
    ],
  },
  {
    id: "youssef-physics",
    studentId: "youssef",
    studentName: "Youssef Ali",
    initials: "YA",
    className: "Grade 4-B",
    title: "Forces and Motion",
    subject: "Physics",
    language: "English",
    submittedAt: "May 15, 2025",
    ocrDone: true,
    finalized: false,
    questions: [
      {
        id: "youssef-q1",
        question: "What force pulls objects toward the Earth?",
        studentAnswer: "Gravity",
        expectedAnswer: "Gravity",
        suggestedScore: 2,
        maxScore: 2,
        rationale: "Correct.",
      },
      {
        id: "youssef-q2",
        question: "A ball rolls on grass and stops. Which force slowed it down?",
        studentAnswer: "Friction",
        expectedAnswer: "Friction",
        suggestedScore: 2,
        maxScore: 2,
        rationale: "Correct.",
      },
      {
        id: "youssef-q3",
        question: "Explain why it is easier to push an empty box than a full box.",
        studentAnswer: "Because the full box is heavier so you need more force.",
        expectedAnswer: "The full box has more mass, so a bigger force is needed to move it.",
        suggestedScore: 2,
        maxScore: 3,
        rationale: "Correct idea, but uses “heavier” instead of the word “mass”.",
      },
    ],
  },
];

export const initialExtraGaps: LearningGap[] = [
  {
    id: "gap-laila-regrouping",
    studentId: "laila",
    studentName: "Laila Hany",
    initials: "LH",
    className: "Grade 3-A",
    grade: "Grade 3",
    subject: "Mathematics",
    topic: "Regrouping in addition",
    title: "Forgets to carry when regrouping in addition",
    description:
      "Laila did not carry to the next column in two questions, which gave answers that are too small.",
    aiTitle: "Forgets to carry when regrouping in addition",
    aiDescription:
      "Laila did not carry to the next column in two questions, which gave answers that are too small.",
    confidence: 64,
    confidenceReason:
      "Seen in 2 questions of only 1 exam. In an earlier exam she carried correctly, so this may be rushing rather than a gap.",
    status: "suggested",
    teacherObservation: "",
    gradeTaskId: "laila-addition",
    timeline: [
      {
        examId: "laila-place-value",
        title: "Place Value Quiz",
        date: "Apr 10",
        score: 88,
        relation: "unrelated",
      },
      {
        examId: "laila-two-digit",
        title: "Two-digit Addition",
        date: "Apr 29",
        score: 79,
        relation: "mixed",
      },
      {
        examId: "laila-measurement",
        title: "Measurement Review",
        date: "May 6",
        score: 71,
        relation: "unrelated",
      },
      {
        examId: "laila-addition",
        title: "Three-digit Addition",
        date: "May 15",
        current: true,
        relation: "pattern",
      },
    ],
    evidence: [
      {
        id: "lev-1",
        examId: "laila-addition",
        gradeQuestionId: "laila-q2",
        question: "468 + 157 = ?",
        studentAnswer: "",
        expectedAnswer: "625",
        finding: "Did not carry in the tens and hundreds columns.",
      },
      {
        id: "lev-2",
        examId: "laila-addition",
        gradeQuestionId: "laila-q3",
        question: "276 + 189 (word problem)",
        studentAnswer: "",
        expectedAnswer: "465",
        finding: "Slip in the tens column.",
      },
    ],
    counterEvidence: [
      {
        examId: "laila-two-digit",
        text: "Two-digit Addition: carried correctly in 4 of 5 questions.",
      },
      {
        examId: "laila-addition",
        text: "Three-digit Addition, Q4: 509 + 384 = 893 with correct carrying.",
      },
    ],
  },
];

export type TeacherFlag = {
  studentId: string;
  type: "Automatic" | "Manual";
  status: "pending" | "confirmed" | "dismissed";
  observation: string;
  /** Optional short message sent to the student when the flag is confirmed. */
  studentNote?: string;
};

export const initialExtraFeedback: FeedbackTask[] = [
  {
    id: "laila-addition",
    studentId: "laila",
    message:
      "Well done, Laila! You added 345 + 232 and 509 + 384 perfectly. Let’s practise carrying to the next column, and remember to slow down and check each column.",
    aiMessage:
      "Well done, Laila! You added 345 + 232 and 509 + 384 perfectly. Let’s practise carrying to the next column, and remember to slow down and check each column.",
    aiMessageNoGap:
      "Well done, Laila! You added 345 + 232 and 509 + 384 perfectly. Take your time and show your working; it helps you catch small slips.",
    sendPractice: true,
    practiceApproved: false,
    sent: false,
    questions: [
      {
        id: "lq-1",
        text: "Add: 357 + 168",
        check: "auto",
        answer: "525",
        accepted: [],
        answerSource: "ai",
        hint: "Start with the ones: 7 + 8 = 15. Write 5 and carry 1.",
      },
      {
        id: "lq-2",
        text: "Add: 249 + 376",
        check: "auto",
        answer: "625",
        accepted: [],
        answerSource: "ai",
        hint: "Remember to carry in the ones and the tens.",
      },
      {
        id: "lq-3",
        text: "A farm has 185 hens and 247 ducks. How many birds in total?",
        check: "auto",
        answer: "432",
        accepted: ["432 birds"],
        answerSource: "ai",
        hint: "Add 185 + 247 column by column.",
      },
      {
        id: "lq-4",
        text: "Find the mistake: 468 + 157 = 515",
        check: "teacher",
        answer: "The answer should be 625. The carry was forgotten in the tens and hundreds.",
        accepted: [],
        answerSource: "ai",
      },
    ],
  },
  {
    id: "youssef-physics",
    studentId: "youssef",
    message:
      "Great work, Youssef! You named gravity and friction correctly. Next time, try using the word “mass” when you explain why heavy objects need more force.",
    aiMessage:
      "Great work, Youssef! You named gravity and friction correctly. Next time, try using the word “mass” when you explain why heavy objects need more force.",
    aiMessageNoGap:
      "Great work, Youssef! You named gravity and friction correctly. Next time, try using the word “mass” when you explain why heavy objects need more force.",
    sendPractice: false,
    practiceApproved: false,
    sent: false,
    questions: [],
  },
  {
    id: "fawzy-word-problems",
    studentId: "fawzy",
    message:
      "Good job, Fawzy! You solved the sticker and the groups questions correctly. When a problem says “each” or “every”, stop and check whether you need to multiply.",
    aiMessage:
      "Good job, Fawzy! You solved the sticker and the groups questions correctly. When a problem says “each” or “every”, stop and check whether you need to multiply.",
    aiMessageNoGap:
      "Good job, Fawzy! You solved the sticker and the groups questions correctly. When a problem says “each” or “every”, stop and check whether you need to multiply.",
    sendPractice: false,
    practiceApproved: false,
    sent: false,
    questions: [],
  },
];

/** Teacher decisions on red flags. Automatic flags are only suggestions until decided here. */
export const initialTeacherFlags: TeacherFlag[] = [];

export type Student = {
  id: string;
  name: string;
  initials: string;
  grade: string;
  className: string;
  latestScore: number;
  trend: "up" | "down" | "steady";
  scores: number[];
  status: ExamStatus;
  flag?: "Automatic" | "Manual";
  note?: string;
};

export type Exam = {
  id: string;
  studentId: string;
  studentName: string;
  title: string;
  subject: string;
  language: "English" | "German";
  date: string;
  score?: number;
  status: ExamStatus;
  action?: "OCR" | "Grade" | "Practice";
};

export const teacher = {
  name: "Ms. Nadia Farouk",
  firstName: "Nadia",
  classes: [
    { name: "Grade 3-A", grade: "Grade 3", short: "3-A", students: 22 },
    { name: "Grade 3-B", grade: "Grade 3", short: "3-B", students: 21 },
    { name: "Grade 3-C", grade: "Grade 3", short: "3-C", students: 23 },
    { name: "Grade 4-A", grade: "Grade 4", short: "4-A", students: 24 },
    { name: "Grade 4-B", grade: "Grade 4", short: "4-B", students: 24 },
    { name: "Grade 4-C", grade: "Grade 4", short: "4-C", students: 22 },
  ],
};

export const students: Student[] = [
  {
    id: "omar",
    name: "Omar Tarek",
    initials: "OT",
    grade: "Grade 4",
    className: "Grade 4-B",
    latestScore: 52,
    trend: "down",
    scores: [58, 55, 52],
    status: "Graded",
    note: "Repeated difficulty comparing fractions",
  },
  {
    id: "laila",
    name: "Laila Hany",
    initials: "LH",
    grade: "Grade 3",
    className: "Grade 3-A",
    latestScore: 71,
    trend: "down",
    scores: [88, 79, 71],
    status: "Teacher checking",
    note: "Passing, with a declining score trend",
  },
  {
    id: "youssef",
    name: "Youssef Ali",
    initials: "YA",
    grade: "Grade 4",
    className: "Grade 4-B",
    latestScore: 86,
    trend: "up",
    scores: [74, 81, 86],
    status: "Teacher checking",
  },
  {
    id: "mariam",
    name: "Mariam Adel",
    initials: "MA",
    grade: "Grade 3",
    className: "Grade 3-A",
    latestScore: 93,
    trend: "steady",
    scores: [91, 94, 93],
    status: "Graded",
  },
  {
    id: "adam",
    name: "Adam Samir",
    initials: "AS",
    grade: "Grade 4",
    className: "Grade 4-B",
    latestScore: 59,
    trend: "down",
    scores: [68, 64, 59],
    status: "Teacher checking",
    note: "Below the 60% class threshold",
  },
  {
    id: "nour",
    name: "Nour Emad",
    initials: "NE",
    grade: "Grade 3",
    className: "Grade 3-C",
    latestScore: 78,
    trend: "up",
    scores: [69, 73, 78],
    status: "Teacher checking",
  },
  {
    id: "karim",
    name: "Karim Mostafa",
    initials: "KM",
    grade: "Grade 4",
    className: "Grade 4-B",
    latestScore: 82,
    trend: "steady",
    scores: [80, 84, 82],
    status: "Graded",
  },
  {
    id: "salma",
    name: "Salma Waleed",
    initials: "SW",
    grade: "Grade 3",
    className: "Grade 3-B",
    latestScore: 64,
    trend: "up",
    scores: [57, 61, 64],
    status: "Teacher checking",
  },
  {
    id: "ahmed",
    name: "Ahmed Khalid",
    initials: "AK",
    grade: "Grade 3",
    className: "Grade 3-A",
    latestScore: 78,
    trend: "up",
    scores: [72, 75, 78],
    status: "Graded",
  },
  {
    id: "fawzy",
    name: "Fawzy Ibrahim",
    initials: "FI",
    grade: "Grade 3",
    className: "Grade 3-B",
    latestScore: 61,
    trend: "down",
    scores: [66, 63, 61],
    status: "Teacher checking",
    note: "Mixes up when to add and when to multiply",
  },
  {
    id: "yehia",
    name: "Yehia Wael",
    initials: "YW",
    grade: "Grade 3",
    className: "Grade 3-B",
    latestScore: 90,
    trend: "up",
    scores: [84, 86, 90],
    status: "Teacher checking",
  },
  {
    id: "haytham",
    name: "Haytham Hesham",
    initials: "HH",
    grade: "Grade 3",
    className: "Grade 3-C",
    latestScore: 80,
    trend: "steady",
    scores: [79, 77, 80],
    status: "Graded",
  },
  {
    id: "amr",
    name: "Amr Elsayed",
    initials: "AE",
    grade: "Grade 4",
    className: "Grade 4-A",
    latestScore: 57,
    trend: "steady",
    scores: [55, 58, 57],
    status: "Graded",
    note: "Below the 60% class threshold",
  },
  {
    id: "hana",
    name: "Hana Mostafa",
    initials: "HM",
    grade: "Grade 4",
    className: "Grade 4-A",
    latestScore: 94,
    trend: "up",
    scores: [88, 91, 94],
    status: "Graded",
  },
  {
    id: "farida",
    name: "Farida Nabil",
    initials: "FN",
    grade: "Grade 4",
    className: "Grade 4-C",
    latestScore: 90,
    trend: "steady",
    scores: [92, 89, 90],
    status: "Graded",
  },
  {
    id: "ziad",
    name: "Ziad Hassan",
    initials: "ZH",
    grade: "Grade 4",
    className: "Grade 4-C",
    latestScore: 59,
    trend: "down",
    scores: [70, 64, 59],
    status: "Graded",
    note: "Below the 60% class threshold",
  },
];

export const exams: Exam[] = [
  {
    id: "yehia-multiplication",
    studentId: "yehia",
    studentName: "Yehia Wael",
    title: "Multiplication Facts",
    subject: "Mathematics",
    language: "English",
    date: "May 16, 2025",
    status: "Teacher checking",
    action: "OCR",
  },
  {
    id: "fawzy-word-problems",
    studentId: "fawzy",
    studentName: "Fawzy Ibrahim",
    title: "Word Problems – Unit 2",
    subject: "Mathematics",
    language: "English",
    date: "May 16, 2025",
    status: "Teacher checking",
    action: "Grade",
  },
  {
    id: "fractions-3",
    studentId: "omar",
    studentName: "Omar Tarek",
    title: "Fractions Test – Unit 3",
    subject: "Mathematics",
    language: "English",
    date: "May 14, 2025",
    score: 52,
    status: "Graded",
  },
  {
    id: "word-problems",
    studentId: "omar",
    studentName: "Omar Tarek",
    title: "Word Problems Check",
    subject: "Mathematics",
    language: "English",
    date: "Apr 28, 2025",
    score: 55,
    status: "Graded",
  },
  {
    id: "multiplication",
    studentId: "omar",
    studentName: "Omar Tarek",
    title: "Multiplication Review",
    subject: "Mathematics",
    language: "English",
    date: "Apr 8, 2025",
    score: 58,
    status: "Graded",
  },
  {
    id: "laila-addition",
    studentId: "laila",
    studentName: "Laila Hany",
    title: "Three-digit Addition",
    subject: "Mathematics",
    language: "English",
    date: "May 15, 2025",
    status: "Teacher checking",
    action: "Grade",
  },
  {
    id: "youssef-physics",
    studentId: "youssef",
    studentName: "Youssef Ali",
    title: "Forces and Motion",
    subject: "Physics",
    language: "English",
    date: "May 15, 2025",
    status: "Teacher checking",
    action: "Grade",
  },
  {
    id: "nour-german",
    studentId: "nour",
    studentName: "Nour Emad",
    title: "Mathematik – Brüche",
    subject: "Mathematics",
    language: "German",
    date: "May 15, 2025",
    status: "Teacher checking",
    action: "OCR",
  },
  {
    id: "adam-fractions",
    studentId: "adam",
    studentName: "Adam Samir",
    title: "Equivalent Fractions",
    subject: "Mathematics",
    language: "English",
    date: "May 14, 2025",
    status: "Teacher checking",
    action: "OCR",
  },
];

export const notifications = [
  {
    id: "n1",
    title: "Your Fractions Test is ready",
    body: "Your teacher has checked your results.",
    time: "2 hours ago",
    kind: "success",
  },
  {
    id: "n2",
    title: "New practice is waiting",
    body: "Try 5 questions about comparing fractions.",
    time: "Yesterday",
    kind: "ai",
  },
];

export const learningGapJourney = [
  "Assessment evidence",
  "Repeated mistakes",
  "AI suggestion",
  "Teacher verification",
  "Confirmed learning gap",
  "Personalized feedback",
  "Targeted practice",
  "Progress",
];

export type SubjectExam = {
  examId: string;
  title: string;
  date: string;
  score: number;
};

/** Omar's graded exams, grouped by subject (newest last). */
export const omarSubjectHistory: Record<string, SubjectExam[]> = {
  Mathematics: [
    { examId: "multiplication", title: "Multiplication Review", date: "Apr 8", score: 58 },
    { examId: "word-problems", title: "Word Problems Check", date: "Apr 28", score: 55 },
    { examId: "fractions-3", title: "Fractions Test – Unit 3", date: "May 14", score: 52 },
  ],
  Physics: [
    { examId: "physics-light", title: "Light and Shadows", date: "Mar 30", score: 74 },
    { examId: "physics-magnets", title: "Magnets", date: "Apr 20", score: 79 },
  ],
};