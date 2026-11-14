import {
  createContext,
  Fragment,
  FormEvent,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Exam,
  ExamStatus,
  ExamSubmission,
  exams,
  FeedbackDraft,
  FeedbackTask,
  GradeQuestion,
  GradeTask,
  LearningGap,
  initialExamSubmission,
  initialExtraFeedback,
  initialExtraGaps,
  initialExtraGradeTasks,
  initialExtraOcrTasks,
  initialStudentSubmissions,
  initialTeacherFlags,
  initialTeacherWorkflow,
  notifications,
  OCRAnswer,
  OCRTask,
  omarSubjectHistory,
  PracticeQuestion,
  Student,
  students,
  SubjectExam,
  SubmissionPage,
  TeacherFlag,
  TeacherWorkflow,
  teacher,
} from "./data";

type Role = "student" | "teacher";
type View =
  | "login"
  | "student-home"
  | "student-upload"
  | "student-quality"
  | "student-confirmation"
  | "student-results"
  | "student-practice"
  | "student-progress"
  | "teacher-dashboard"
  | "teacher-ocr"
  | "teacher-grade"
  | "teacher-gaps-overview"
  | "teacher-grading-list"
  | "teacher-practice-builder"
  | "teacher-students"
  | "teacher-flags"
  | "teacher-feedback"
  | "placeholder";

/** The signed-in teacher only ever sees work from her own subject. */
const TEACHER_SUBJECT = "Mathematics";
const mySubject = <T extends { subject: string }>(item: T) => item.subject === TEACHER_SUBJECT;

/** Omar has a different teacher for each subject. */
type SubjectInfo = {
  name: string;
  full: string;
  initials: string;
  emoji: string;
  color: string;
  soft: string;
};
const subjectTeachers: Record<string, SubjectInfo> = {
  Mathematics: {
    name: "Ms. Nadia",
    full: "Ms. Nadia Farouk",
    initials: "NF",
    emoji: "🔢",
    color: "#4776E6",
    soft: "#EDF2FF",
  },
  Physics: {
    name: "Mr. Hassan",
    full: "Mr. Hassan Adel",
    initials: "HA",
    emoji: "🧲",
    color: "#8065D9",
    soft: "#F1EDFD",
  },
  English: {
    name: "Ms. Sara",
    full: "Ms. Sara Lewis",
    initials: "SL",
    emoji: "🔤",
    color: "#239B72",
    soft: "#E6F6EF",
  },
  German: {
    name: "Frau Weber",
    full: "Frau Anna Weber",
    initials: "AW",
    // Not a flag: Windows shows flag emojis as plain letters ("DE").
    emoji: "🥨",
    color: "#D97A2B",
    soft: "#FFF1E3",
  },
  Arabic: {
    name: "Mr. Khaled",
    full: "Mr. Khaled Samir",
    initials: "KS",
    emoji: "🖋️",
    color: "#C2457A",
    soft: "#FDEDF4",
  },
  Art: {
    name: "Ms. Mona",
    full: "Ms. Mona Fathy",
    initials: "MF",
    emoji: "🎨",
    color: "#2B9BB5",
    soft: "#E5F6FA",
  },
};
const otherSubject: SubjectInfo = {
  name: "your teacher",
  full: "Your teacher",
  initials: "T",
  emoji: "📚",
  color: "#5B6779",
  soft: "#EEF1F6",
};
const subjectInfo = (subject?: string) => subjectTeachers[subject ?? ""] ?? otherSubject;
const teacherFor = (subject?: string) => subjectInfo(subject).name;
const teacherInitials = (subject?: string) => subjectInfo(subject).initials;
/** Colour variables for one subject, used by chips, tabs and avatars. */
const subjectStyle = (subject?: string) =>
  ({
    "--sc": subjectInfo(subject).color,
    "--sc-soft": subjectInfo(subject).soft,
  }) as React.CSSProperties;

/** Older, already-graded tests from Omar's other subjects (so the app shows a full timetable). */
const otherSubjectResults: ExamSubmission[] = [
  ["omar-english-reading", "Reading Check – Unit 2", "English", "English", "May 12, 2025", 85],
  ["omar-german-words", "Wörter – Lektion 3", "German", "German", "May 9, 2025", 72],
  ["omar-arabic-spelling", "Spelling Quiz", "Arabic", "English", "May 7, 2025", 90],
].map(([id, examName, subject, language, submittedAt, grade]) => ({
  id: id as string,
  studentId: "omar",
  examName: examName as string,
  customExamName: "",
  subject: subject as string,
  language: language as "English" | "German",
  pages: [],
  status: "Graded" as const,
  submitted: true,
  submittedAt: submittedAt as string,
  reference: `LL-${(id as string).toUpperCase()}`,
  grade: grade as number,
}));

type StudentNotification = {
  id: string;
  title: string;
  body: string;
  time: string;
  kind: "success" | "practice" | "message";
  /** Which subject (and so which teacher) this is from. */
  subject?: string;
  destination?: "Results" | "Practice" | "Home" | "Progress";
  examId?: string;
  read: boolean;
};

type PracticeAnswerRecord = {
  questionId: string;
  question: string;
  answer: string;
  check: "auto" | "teacher";
  /** Correct answer (auto) or model answer (teacher-check). */
  modelAnswer: string;
  /** Result of the automatic check (auto questions only). */
  correct?: boolean;
  /** Ms. Nadia's decision for teacher-check questions. */
  teacherMark?: "correct" | "not-yet";
  teacherComment?: string;
};

type PracticeResult = {
  completed: boolean;
  /** Every answer, so Ms. Nadia can review the open ones. */
  items: PracticeAnswerRecord[];
  /** True once Ms. Nadia has checked the open answers (or there were none). */
  reviewed: boolean;
  /** Final number right after Ms. Nadia's review. */
  finalCorrect?: number;
  /** Correct answers among the auto-checked questions. */
  correct: number;
  /** All questions answered. */
  total: number;
  /** Questions LearnLens could check automatically. */
  checkedTotal: number;
  /** Open questions saved for Ms. Nadia to check. */
  savedForTeacher: number;
  completedAt: string;
  answers: string[];
};

type StudentNotificationProps = {
  studentNotifications: StudentNotification[];
  onOpenStudentNotification: (notification: StudentNotification) => void;
};

const StudentNotificationContext = createContext<StudentNotificationProps>({
  studentNotifications: [],
  onOpenStudentNotification: () => undefined,
});
type IconName =
  | "spark"
  | "home"
  | "upload"
  | "results"
  | "practice"
  | "progress"
  | "dashboard"
  | "scan"
  | "grade"
  | "journey"
  | "flag"
  | "message"
  | "logout"
  | "bell"
  | "search"
  | "chevron"
  | "trend"
  | "book"
  | "clock"
  | "check"
  | "user"
  | "lock"
  | "users"
  | "filter"
  | "arrow"
  | "school"
  | "camera"
  | "plus"
  | "trash"
  | "zoom-in"
  | "zoom-out"
  | "file";

const paths: Record<IconName, ReactNode> = {
  spark: (
    <path d="m12 2 1.35 4.25L17.6 7.6l-4.25 1.35L12 13.2l-1.35-4.25L6.4 7.6l4.25-1.35L12 2Zm6.2 11.3.8 2.5 2.5.8-2.5.8-.8 2.5-.8-2.5-2.5-.8 2.5-.8.8-2.5ZM5 13l.9 2.9 2.9.9-2.9.9L5 20.6l-.9-2.9-2.9-.9 2.9-.9L5 13Z" />
  ),
  home: (
    <>
      <path d="m3 11 9-8 9 8" />
      <path d="M5 10v10h14V10M9 20v-6h6v6" />
    </>
  ),
  upload: (
    <>
      <path d="M12 16V4m0 0L7 9m5-5 5 5" />
      <path d="M4 15v5h16v-5" />
    </>
  ),
  results: (
    <>
      <path d="M5 3h14v18H5z" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </>
  ),
  practice: (
    <>
      <path d="m4 19 4.5-1 9.8-9.8a2.1 2.1 0 0 0-3-3L5.5 15 4 19Z" />
      <path d="m13.8 6.7 3 3" />
    </>
  ),
  progress: (
    <>
      <path d="M4 19V9m6 10V5m6 14v-7m5 7H2" />
    </>
  ),
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
    </>
  ),
  scan: (
    <>
      <path d="M8 3H4a1 1 0 0 0-1 1v4m13-5h4a1 1 0 0 1 1 1v4M8 21H4a1 1 0 0 1-1-1v-4m13 5h4a1 1 0 0 0 1-1v-4" />
      <path d="M7 12h10M9 8h6M9 16h6" />
    </>
  ),
  grade: (
    <>
      <path d="M4 4h16v16H4z" />
      <path d="m8 12 2.5 2.5L16 9" />
    </>
  ),
  journey: (
    <>
      <circle cx="6" cy="6" r="2" />
      <circle cx="18" cy="18" r="2" />
      <path d="M8 6h5a3 3 0 0 1 3 3v0a3 3 0 0 1-3 3h-2a3 3 0 0 0-3 3v0a3 3 0 0 0 3 3h5" />
    </>
  ),
  flag: (
    <>
      <path d="M5 21V4m0 0h10l-1.5 3L15 10H5" />
    </>
  ),
  message: (
    <>
      <path d="M4 4h16v13H8l-4 4V4Z" />
      <path d="M8 9h8M8 13h5" />
    </>
  ),
  logout: (
    <>
      <path d="M10 4H4v16h6M14 8l4 4-4 4m4-4H8" />
    </>
  ),
  bell: (
    <>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </>
  ),
  chevron: <path d="m9 6 6 6-6 6" />,
  trend: (
    <>
      <path d="m4 16 5-5 4 4 7-8" />
      <path d="M15 7h5v5" />
    </>
  ),
  book: (
    <>
      <path d="M4 5a3 3 0 0 1 3-2h5v17H7a3 3 0 0 0-3 2V5Z" />
      <path d="M20 5a3 3 0 0 0-3-2h-5v17h5a3 3 0 0 1 3 2V5Z" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  lock: (
    <>
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="4" />
      <path d="M2 21a7 7 0 0 1 14 0M17 5a4 4 0 0 1 0 7m2 9a7 7 0 0 0-3-5.7" />
    </>
  ),
  filter: <path d="M3 5h18l-7 8v6l-4 2v-8L3 5Z" />,
  arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
  school: (
    <>
      <path d="m3 10 9-6 9 6-9 6-9-6Z" />
      <path d="M7 13v4c3 2 7 2 10 0v-4M21 10v6" />
    </>
  ),
  camera: (
    <>
      <path d="M4 7h3l1.5-2h7L17 7h3v12H4V7Z" />
      <circle cx="12" cy="13" r="4" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  trash: (
    <>
      <path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" />
    </>
  ),
  "zoom-in": (
    <>
      <circle cx="10" cy="10" r="7" />
      <path d="m15 15 6 6M7 10h6M10 7v6" />
    </>
  ),
  "zoom-out": (
    <>
      <circle cx="10" cy="10" r="7" />
      <path d="m15 15 6 6M7 10h6" />
    </>
  ),
  file: (
    <>
      <path d="M6 3h8l4 4v14H6V3Z" />
      <path d="M14 3v5h5M9 13h6M9 17h5" />
    </>
  ),
};

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={name === "spark" ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

function Logo({ light = false }: { light?: boolean }) {
  return (
    <div className={`logo ${light ? "logo-light" : ""}`}>
      <span className="logo-mark">
        <Icon name="spark" size={21} />
      </span>
      <span>LearnLens</span>
    </div>
  );
}

function Button({
  children,
  variant = "primary",
  className = "",
  type = "button",
  onClick,
  disabled = false,
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "purple";
  className?: string;
  type?: "button" | "submit";
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type={type}
      className={`button button-${variant} ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

function Badge({
  children,
  type = "neutral",
}: {
  children: ReactNode;
  type?: "success" | "warning" | "danger" | "ai" | "neutral" | "blue";
}) {
  return <span className={`badge badge-${type}`}>{children}</span>;
}

const studentNav: { label: string; icon: IconName; display?: string }[] = [
  { label: "Home", icon: "home" },
  { label: "Upload Exam", icon: "upload", display: "Send my test" },
  { label: "Results", icon: "results", display: "My results" },
  { label: "Practice", icon: "practice" },
  { label: "Progress", icon: "progress", display: "My progress" },
];

const teacherNav: { label: string; icon: IconName; divider?: boolean; display?: string }[] = [
  { label: "Dashboard", icon: "dashboard" },
  { label: "Grading", icon: "grade" },
  { label: "Practice", icon: "practice" },
  { label: "Red Flags", icon: "flag" },
  { label: "Students", icon: "users", divider: true },
];
/** All four stages of the grading workspace sit under "Grading" in the sidebar. */
const reviewScreens = ["OCR Verification", "Grade Review", "Grading", "Feedback"];

/** Collapsible sidebar state, shared by every portal screen. */
const SidebarContext = createContext<{ collapsed: boolean; toggle: () => void }>({
  collapsed: false,
  toggle: () => {},
});

/** Task counts shown as badges on the teacher sidebar, keyed by menu label. */
const NavCountContext = createContext<Record<string, number>>({});

function Sidebar({
  role,
  active,
  onNavigate,
  onLogout,
}: {
  role: Role;
  active: string;
  onNavigate: (label: string) => void;
  onLogout: () => void;
}) {
  const items = role === "student" ? studentNav : teacherNav;
  const current = role === "teacher" && reviewScreens.includes(active) ? "Grading" : active;
  const navCounts = useContext(NavCountContext);
  const { collapsed, toggle } = useContext(SidebarContext);
  const name = role === "student" ? "Omar Tarek" : "Nadia Farouk";
  return (
    <aside className={`sidebar sidebar-${role} ${collapsed ? "collapsed" : ""}`}>
      <div className="sidebar-top">
        <Logo light={role === "teacher"} />
        <button
          className="sidebar-toggle"
          onClick={toggle}
          aria-label={collapsed ? "Expand menu" : "Collapse menu"}
          aria-expanded={!collapsed}
          data-tip={collapsed ? "Expand menu" : undefined}
        >
          <Icon name="chevron" size={16} />
        </button>
      </div>
      <div className="sidebar-role">{role === "student" ? "STUDENT PORTAL" : "TEACHER PORTAL"}</div>
      <nav className="nav-list" aria-label={`${role} navigation`}>
        {items.map((item) => {
          const count = role === "teacher" ? (navCounts[item.label] ?? 0) : 0;
          const showCount = count > 0;
          return (
            <button
              key={item.label}
              className={`nav-item ${current === item.label ? "active" : ""} ${"divider" in item && item.divider ? "nav-divider" : ""}`}
              onClick={() => onNavigate(item.label)}
              aria-label={collapsed ? item.label : undefined}
              data-tip={
                collapsed ? (showCount ? `${item.label} (${count})` : item.label) : undefined
              }
            >
              <Icon name={item.icon} />
              <span className="nav-label">
                {"display" in item && item.display ? item.display : item.label}
              </span>
              {showCount && <span className="nav-count">{count}</span>}
            </button>
          );
        })}
      </nav>
      <div className="sidebar-bottom">
        <div className="profile-mini" data-tip={collapsed ? name : undefined}>
          <div className="avatar">{role === "student" ? "OT" : "NF"}</div>
          <div className="profile-text">
            <strong>{name}</strong>
            <span>{role === "student" ? "Grade 4" : "Mathematics teacher"}</span>
          </div>
        </div>
        <button
          className="logout-button"
          onClick={onLogout}
          aria-label={collapsed ? "Log out" : undefined}
          data-tip={collapsed ? "Log out" : undefined}
        >
          <Icon name="logout" />
          <span className="nav-label">Log out</span>
        </button>
      </div>
    </aside>
  );
}

function PortalLayout({
  role,
  active,
  children,
  onNavigate,
  onLogout,
}: {
  role: Role;
  active: string;
  children: ReactNode;
  onNavigate: (label: string) => void;
  onLogout: () => void;
}) {
  const { collapsed } = useContext(SidebarContext);
  return (
    <div className={`portal portal-${role} ${collapsed ? "sidebar-collapsed" : ""}`}>
      <Sidebar role={role} active={active} onNavigate={onNavigate} onLogout={onLogout} />
      <main className="portal-main">{children}</main>
    </div>
  );
}

function Login({ onEnter }: { onEnter: (role: Role) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ username?: string; password?: string; login?: string }>(
    {},
  );
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const nextErrors: { username?: string; password?: string; login?: string } = {};
    const normalizedUsername = username.trim().toLowerCase();

    if (!normalizedUsername) nextErrors.username = "Enter your username.";
    if (!password.trim()) nextErrors.password = "Enter your password.";
    if (!nextErrors.username && !nextErrors.password) {
      if (normalizedUsername === "omar.tarek") onEnter("student");
      else if (normalizedUsername === "nadia.farouk") onEnter("teacher");
      else nextErrors.login = "We couldn’t find that username. Please check it and try again.";
    }
    setErrors(nextErrors);
  };

  return (
    <div className="login-page">
      <div className="login-brand-panel">
        <div className="brand-glow brand-glow-one" />
        <div className="brand-glow brand-glow-two" />
        <Logo light />
        <div className="login-message">
          <Badge type="ai">
            <Icon name="spark" size={14} /> AI-assisted learning
          </Badge>
          <div className="display-title">See every learner more clearly.</div>
          <p>
            LearnLens helps students grow and gives teachers the evidence they need to make
            confident decisions.
          </p>
        </div>
        <div className="brand-footer">Built for Grades 1–5 · English & German</div>
      </div>
      <div className="login-form-panel">
        <form className="login-card" onSubmit={handleSubmit}>
          <div className="eyebrow">WELCOME TO LEARNLENS</div>
          <div className="login-title" role="heading" aria-level={1}>
            Sign in to continue
          </div>
          <p className="login-subtitle">Sign in to access your learning workspace.</p>

          <label className="field">
            <span>Username</span>
            <div className={`input-wrap ${errors.username ? "input-error" : ""}`}>
              <Icon name="user" />
              <input
                type="text"
                value={username}
                onChange={(event) => {
                  setUsername(event.target.value);
                  setErrors({});
                }}
                placeholder="Enter your username"
                autoComplete="username"
              />
            </div>
            {errors.username && <small className="field-error">{errors.username}</small>}
          </label>
          <label className="field">
            <span>Password</span>
            <div className={`input-wrap ${errors.password ? "input-error" : ""}`}>
              <Icon name="lock" />
              <input
                type="password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setErrors({});
                }}
                placeholder="Enter your password"
                autoComplete="current-password"
              />
            </div>
            {errors.password && <small className="field-error">{errors.password}</small>}
          </label>
          {errors.login && (
            <div className="login-error" role="alert">
              {errors.login}
            </div>
          )}
          <Button type="submit" className="full-button">
            Sign in <Icon name="arrow" />
          </Button>
        </form>
      </div>
    </div>
  );
}

function Topbar({
  title,
  subtitle,
  student = false,
  action,
  studentNotifications,
  onOpenStudentNotification,
}: {
  title: string;
  subtitle: string;
  student?: boolean;
  action?: ReactNode;
  studentNotifications?: StudentNotification[];
  onOpenStudentNotification?: (notification: StudentNotification) => void;
}) {
  const notificationContext = useContext(StudentNotificationContext);
  const visibleNotifications = studentNotifications ?? notificationContext.studentNotifications;
  const openStudentNotification =
    onOpenStudentNotification ?? notificationContext.onOpenStudentNotification;
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  const hasUnread = visibleNotifications.some((notification) => !notification.read);

  useEffect(() => {
    if (!notificationsOpen) return;
    const closeOnOutside = (event: MouseEvent) => {
      if (!notificationRef.current?.contains(event.target as Node)) {
        setNotificationsOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setNotificationsOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [notificationsOpen]);

  return (
    <header className="topbar">
      <div>
        <div className="page-title" role="heading" aria-level={1}>
          {title}
        </div>
        <p>{subtitle}</p>
      </div>
      <div className="topbar-actions">
        {action}
        {student ? (
          <div className="student-notification-wrap" ref={notificationRef}>
            <button
              className="icon-button"
              aria-label="Notifications"
              aria-expanded={notificationsOpen}
              onClick={() => setNotificationsOpen((current) => !current)}
            >
              <Icon name="bell" />
              {hasUnread && <span className="notification-dot" />}
            </button>
            {notificationsOpen && (
              <div className="student-notification-dropdown">
                <div className="student-notification-head">
                  <div>
                    <strong>Notifications</strong>
                    <span>{hasUnread ? "You have something new" : "You’re all caught up"}</span>
                  </div>
                  <Badge type={hasUnread ? "blue" : "success"}>
                    {visibleNotifications.filter((item) => !item.read).length} new
                  </Badge>
                </div>
                <div className="student-notification-menu">
                  {visibleNotifications.map((notification) => (
                    <button
                      key={notification.id}
                      className={`student-notification-menu-item ${notification.read ? "" : "unread"}`}
                      onClick={() => {
                        openStudentNotification(notification);
                        setNotificationsOpen(false);
                      }}
                    >
                      <span className={`student-notification-menu-icon ${notification.kind}`}>
                        <Icon
                          name={
                            notification.kind === "practice"
                              ? "practice"
                              : notification.kind === "message"
                                ? "message"
                                : "check"
                          }
                          size={17}
                        />
                      </span>
                      <span className="student-notification-menu-copy">
                        <strong>{notification.title}</strong>
                        <small>{notification.body}</small>
                        <em>{notification.time}</em>
                      </span>
                      {!notification.read && <i className="student-unread-mark" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <button className="icon-button" aria-label="Notifications">
            <Icon name="bell" />
            <span className="notification-dot" />
          </button>
        )}
        <div className={`avatar ${student ? "" : "avatar-navy"}`}>{student ? "OT" : "NF"}</div>
      </div>
    </header>
  );
}

// ---------- Student badges: only real, earned achievements (shown on Home) ----------
type BadgeDef = {
  id: "explorer" | "sharp" | "careful" | "stronger";
  title: string;
  description: string;
  icon: IconName;
};
const badgeDefinitions: BadgeDef[] = [
  {
    id: "explorer",
    title: "Topic Explorer",
    description: "You finished the practice Ms. Nadia picked for you.",
    icon: "spark",
  },
  {
    id: "sharp",
    title: "Sharp Thinker",
    description: "Every auto-checked practice answer was right.",
    icon: "check",
  },
  {
    id: "careful",
    title: "Careful Checker",
    description: "You retook a blurry photo so your teacher could read it.",
    icon: "scan",
  },
  {
    id: "stronger",
    title: "Getting Stronger",
    description: "You scored higher than last time in a subject.",
    icon: "progress",
  },
];
const explorerTitle = (topic: string) =>
  /fraction/i.test(topic) ? "Fraction Explorer" : `${topic} Explorer`;

type StudentBadge = BadgeDef & {
  earned: boolean;
  /** Short reason shown under an earned badge. */
  detail: string;
  /** How to earn it next, when that is possible right now. */
  next?: { text: string; destination: string };
};

/** Omar's graded exams per subject, including the newest exam once the teacher releases it. */
function liveSubjectHistory(workflow: TeacherWorkflow) {
  const history: Record<string, SubjectExam[]> = {};
  Object.entries(omarSubjectHistory).forEach(([subject, list]) => {
    history[subject] = [...list];
  });
  if (workflow.feedback.sent && workflow.finalScore !== undefined) {
    const subject = workflow.exam.subject;
    history[subject] = [
      ...(history[subject] ?? []),
      {
        examId: workflow.exam.id,
        title: workflow.exam.title,
        date: "May 19",
        score: workflow.finalScore,
      },
    ];
  }
  return history;
}

function computeStudentBadges(
  workflow: TeacherWorkflow,
  practiceResult: PracticeResult | null,
  submissions: ExamSubmission[],
): StudentBadge[] {
  const practiceAvailable =
    workflow.feedback.sent &&
    workflow.feedback.sendPractice &&
    workflow.feedback.questions.length > 0;
  const done = Boolean(practiceResult?.completed);
  const perfect =
    done &&
    (practiceResult?.checkedTotal ?? 0) > 0 &&
    practiceResult?.correct === practiceResult?.checkedTotal;
  const retook = submissions.some(
    (exam) =>
      exam.studentId === "omar" && exam.submitted && exam.pages.some((page) => page.retaken),
  );
  const improved = Object.entries(liveSubjectHistory(workflow))
    .map(([subject, list]) => ({ subject, list }))
    .find(
      ({ list }) => list.length > 1 && list[list.length - 1].score > list[list.length - 2].score,
    );

  return badgeDefinitions.map((badge) => {
    if (badge.id === "explorer")
      return {
        ...badge,
        title: explorerTitle(workflow.gap.topic),
        earned: done,
        detail: done ? `Finished ${practiceResult?.total} practice questions` : "",
        next:
          practiceAvailable && !done
            ? {
                text: `Finish your ${workflow.feedback.questions.length} practice questions`,
                destination: "Practice",
              }
            : undefined,
      };
    if (badge.id === "sharp")
      return {
        ...badge,
        earned: perfect,
        detail: perfect
          ? `${practiceResult?.correct} of ${practiceResult?.checkedTotal} right`
          : "",
        next:
          practiceAvailable && !perfect
            ? {
                text: done
                  ? "Practise again and get every answer right"
                  : "Get every practice answer right",
                destination: "Practice",
              }
            : undefined,
      };
    if (badge.id === "careful")
      return {
        ...badge,
        earned: retook,
        detail: retook ? "Retook a blurry page" : "",
        next: retook
          ? undefined
          : {
              text: "Check every photo is sharp before you send an exam",
              destination: "Upload Exam",
            },
      };
    return {
      ...badge,
      earned: Boolean(improved),
      detail: improved
        ? `${improved.subject}: ${improved.list[improved.list.length - 2].score}% → ${improved.list[improved.list.length - 1].score}%`
        : "",
      next: improved
        ? undefined
        : { text: "Score higher than last time in any subject", destination: "Progress" },
    };
  });
}

/** "Read to me" — uses the browser's built-in voice. Text always stays on screen too. */
function ReadAloud({ text, lang = "en-US" }: { text: string; lang?: string }) {
  const [speaking, setSpeaking] = useState(false);
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;
  useEffect(
    () => () => {
      try {
        window.speechSynthesis?.cancel();
      } catch {
        /* ignore */
      }
    },
    [],
  );
  if (!supported) return null;
  const toggle = () => {
    try {
      if (speaking) {
        window.speechSynthesis.cancel();
        setSpeaking(false);
        return;
      }
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      utterance.rate = 0.9;
      utterance.onend = () => setSpeaking(false);
      utterance.onerror = () => setSpeaking(false);
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
      setSpeaking(true);
    } catch {
      setSpeaking(false);
    }
  };
  return (
    <button
      type="button"
      className={`read-aloud ${speaking ? "on" : ""}`}
      onClick={toggle}
      aria-pressed={speaking}
    >
      <span aria-hidden="true">{speaking ? "■" : "🔊"}</span>
      {speaking ? "Stop" : "Read to me"}
    </button>
  );
}

const speechLang = (language?: string) => (language === "German" ? "de-DE" : "en-US");

function HomeBadges({
  badges,
  onNavigate,
}: {
  badges: StudentBadge[];
  onNavigate: (label: string) => void;
}) {
  const earned = badges.filter((badge) => badge.earned);
  const next = badges.find((badge) => !badge.earned && badge.next);
  return (
    <section className="card home-badges" aria-label="My badges">
      <div className="home-badges-head">
        <div className="section-title" role="heading" aria-level={2}>
          My badges
        </div>
        <span>{earned.length ? `${earned.length} earned` : "Your first badge is close!"}</span>
      </div>
      <div className="home-badges-row">
        {earned.map((badge) => (
          <div className="home-badge" key={badge.id} title={badge.description}>
            <span className="home-badge-icon">
              <Icon name={badge.icon} size={20} />
            </span>
            <div>
              <strong>{badge.title}</strong>
              <small>{badge.detail}</small>
            </div>
          </div>
        ))}
        {next?.next && (
          <button className="home-badge-next" onClick={() => onNavigate(next.next!.destination)}>
            <span className="home-badge-icon next">
              <Icon name={next.icon} size={20} />
            </span>
            <div>
              <small>Next badge: {next.title}</small>
              <strong>{next.next.text}</strong>
            </div>
            <Icon name="arrow" size={16} />
          </button>
        )}
      </div>
    </section>
  );
}

function StudentHome({
  onNavigate,
  onLogout,
  studentNotifications,
  onOpenStudentNotification,
  practiceResult,
  badges,
  workflow,
  submissions,
  resultsSeen,
  warmUpDone,
}: {
  onNavigate: (label: string) => void;
  onLogout: () => void;
  practiceResult: PracticeResult | null;
  badges: StudentBadge[];
  workflow: TeacherWorkflow;
  submissions: ExamSubmission[];
  /** Omar has opened his newest result at least once. */
  resultsSeen: boolean;
  warmUpDone: boolean;
} & StudentNotificationProps) {
  const feedback = workflow.feedback;
  const practiceReady = feedback.sent && feedback.sendPractice && feedback.questions.length > 0;
  const waiting = submissions.filter(
    (exam) => exam.studentId === "omar" && exam.submitted && exam.status !== "Graded",
  );

  // Exactly one thing to do next. The rest of the app is still in the menu.
  type NextUp = {
    tone: "results" | "practice" | "checked" | "waiting" | "send";
    icon: IconName;
    kicker: string;
    title: string;
    text: string;
    button?: { label: string; to: string };
  };
  const next: NextUp =
    feedback.sent && !resultsSeen
      ? {
          tone: "results",
          icon: "results",
          kicker: `Your ${workflow.exam.subject} test is back!`,
          title: workflow.exam.title,
          text: `${teacherFor(workflow.exam.subject)} checked it and wrote you a message.`,
          button: { label: "See my results", to: "Results" },
        }
      : practiceReady && !practiceResult?.completed
        ? {
            tone: "practice",
            icon: "practice",
            kicker: "Next up",
            title: `Practise ${workflow.gap.topic.toLowerCase()}`,
            text: `${workflow.exam.subject} · ${feedback.questions.length} questions picked for you by ${teacherFor(workflow.exam.subject)}. About 10 minutes.`,
            button: { label: "Start practice", to: "Practice" },
          }
        : practiceResult?.completed && practiceResult.reviewed
          ? {
              tone: "checked",
              icon: "check",
              kicker: `${teacherFor(workflow.exam.subject)} checked your ${workflow.exam.subject} practice`,
              title: `You got ${practiceResult.finalCorrect} of ${practiceResult.total} right`,
              text: "Read what she said about your answers.",
              button: { label: "See her comments", to: "Practice" },
            }
          : practiceResult?.completed
            ? {
                tone: "waiting",
                icon: "clock",
                kicker: "Well done for finishing!",
                title: `${teacherFor(workflow.exam.subject)} is checking your practice`,
                text: "We will tell you when she is done. Nothing to do right now.",
                button: { label: "See my progress", to: "Progress" },
              }
            : !practiceReady && !warmUpDone
              ? {
                  tone: "practice",
                  icon: "practice",
                  kicker: "Next up",
                  title: "Fractions warm-up",
                  text: `Mathematics · 5 quick questions from ${teacherFor("Mathematics")}. About 5 minutes.`,
                  button: { label: "Start practice", to: "Practice" },
                }
              : waiting.length
                ? {
                    tone: "waiting",
                    icon: "clock",
                    kicker: "Nothing to do right now",
                    title: `${teacherFor(waiting[0].subject)} is checking your ${waiting[0].subject} test`,
                    text: `${waiting[0].examName}. We will tell you when it is ready.`,
                  }
                : {
                    tone: "send",
                    icon: "upload",
                    kicker: "Next up",
                    title: "Got a new test?",
                    text: "Upload a picture of each page and send it to your teacher.",
                    button: { label: "Send my test", to: "Upload Exam" },
                  };

  const news = studentNotifications.slice(0, 3);
  return (
    <PortalLayout role="student" active="Home" onNavigate={onNavigate} onLogout={onLogout}>
      <Topbar
        title="Hi Omar! 👋"
        subtitle="Here is what to do next, from all your teachers."
        student
        studentNotifications={studentNotifications}
        onOpenStudentNotification={onOpenStudentNotification}
      />
      <div className="content student-content kid-home">
        <section className={`kid-next ${next.tone}`}>
          <span className="kid-next-icon" aria-hidden="true">
            <Icon name={next.icon} size={34} />
          </span>
          <div className="kid-next-copy">
            <span className="kid-next-kicker">{next.kicker}</span>
            <h2>{next.title}</h2>
            <p>{next.text}</p>
          </div>
          {next.button && (
            <Button className="kid-big-button" onClick={() => onNavigate(next.button!.to)}>
              {next.button.label} <Icon name="arrow" />
            </Button>
          )}
        </section>

        <div className="kid-home-grid">
          <section className="card kid-news">
            <div className="kid-section-head">
              <h3>News from your teachers</h3>
              {studentNotifications.some((item) => !item.read) && (
                <span className="kid-new">
                  {studentNotifications.filter((item) => !item.read).length} new
                </span>
              )}
            </div>
            {news.length ? (
              <div className="kid-news-list">
                {news.map((note) => (
                  <button
                    className={`kid-news-item ${note.read ? "" : "unread"}`}
                    key={note.id}
                    onClick={() => onOpenStudentNotification(note)}
                  >
                    <span className={`note-icon note-${note.kind}`}>
                      <Icon
                        name={
                          note.kind === "practice"
                            ? "practice"
                            : note.kind === "message"
                              ? "message"
                              : "check"
                        }
                      />
                    </span>
                    <span className="kid-news-copy">
                      <strong>{note.title}</strong>
                      <small>
                        {note.subject && (
                          <b className="kid-from" style={subjectStyle(note.subject)}>
                            {teacherFor(note.subject)} · {note.subject}
                          </b>
                        )}
                        {note.time}
                      </small>
                    </span>
                    <Icon name="chevron" size={18} />
                  </button>
                ))}
              </div>
            ) : (
              <p className="kid-empty">No news yet.</p>
            )}
          </section>
          <section className="card kid-teachers">
            <div className="kid-section-head">
              <h3>My subjects</h3>
            </div>
            <div className="kid-teacher-list">
              {Object.entries(subjectTeachers).map(([subject, person]) => {
                const checking = waiting.filter((exam) => exam.subject === subject).length;
                const status =
                  subject === workflow.exam.subject && practiceReady && !practiceResult?.completed
                    ? "Practice ready"
                    : checking
                      ? `Checking ${checking} test${checking > 1 ? "s" : ""}`
                      : "";
                return (
                  <div className="kid-teacher" key={subject} style={subjectStyle(subject)}>
                    <span className="kid-teacher-avatar" aria-hidden="true">
                      {person.emoji}
                    </span>
                    <span className="kid-teacher-copy">
                      <strong title={subject}>
                        {subject === "Mathematics" ? "Maths" : subject}
                      </strong>
                      <small>{person.name}</small>
                      {status && <em className="busy">{status}</em>}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <HomeBadges badges={badges} onNavigate={onNavigate} />
      </div>
    </PortalLayout>
  );
}

function createSubmissionPages(files: File[], startIndex: number): SubmissionPage[] {
  return files.map((file, index) => ({
    id: `${Date.now()}-${index}-${file.name}`,
    name: file.name,
    previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
    quality: startIndex + index === 1 ? "blurry" : "clear",
  }));
}

function demoPages(startIndex = 0): SubmissionPage[] {
  return ["Front page", "Fraction answers", "Word problem"].map((name, index) => ({
    id: `demo-${Date.now()}-${index}`,
    name,
    quality: startIndex + index === 1 ? "blurry" : "clear",
  }));
}

function PaperPreview({
  page,
  pageNumber,
  compact = false,
}: {
  page: SubmissionPage;
  pageNumber: number;
  compact?: boolean;
}) {
  if (page.previewUrl) {
    return (
      <img
        className={`paper-image ${compact ? "paper-image-compact" : ""}`}
        src={page.previewUrl}
        alt={`Preview of exam page ${pageNumber}`}
      />
    );
  }
  return (
    <div className={`paper-simulation ${compact ? "paper-simulation-compact" : ""}`}>
      <div className="paper-brand">LearnLens · Mathematics</div>
      <div className="paper-question">Comparing Fractions Quiz</div>
      <div className="paper-line paper-line-long" />
      <div className="paper-fraction-row">
        <span>2/3</span>
        <span>○</span>
        <span>3/5</span>
      </div>
      <div className="paper-line" />
      <div className="paper-line paper-line-short" />
      <div className="paper-page-number">Page {pageNumber}</div>
    </div>
  );
}

function StudentUpload({
  submission,
  setSubmission,
  onReview,
  onNavigate,
  onLogout,
}: {
  submission: ExamSubmission;
  setSubmission: React.Dispatch<React.SetStateAction<ExamSubmission>>;
  onReview: (pageIndex?: number) => void;
  onNavigate: (label: string) => void;
  onLogout: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addInputRef = useRef<HTMLInputElement>(null);
  const [validation, setValidation] = useState("");
  const selectedExamName =
    submission.examName === "Custom exam name" ? submission.customExamName : submission.examName;

  const addFiles = (files: FileList | null) => {
    if (!files?.length) return;
    setSubmission((current) => ({
      ...current,
      pages: [...current.pages, ...createSubmissionPages(Array.from(files), current.pages.length)],
    }));
    setValidation("");
  };

  const review = (pageIndex = 0) => {
    if (!submission.subject || !selectedExamName.trim() || submission.pages.length === 0) {
      setValidation("Choose your exam details and add at least one page before continuing.");
      return;
    }
    onReview(pageIndex);
  };

  return (
    <PortalLayout role="student" active="Upload Exam" onNavigate={onNavigate} onLogout={onLogout}>
      <Topbar
        title="Send my test"
        subtitle="Tell us which test it is, then add its pages."
        student
      />
      <div className="content up up-fit">
        <SendSteps step={1} />

        <div className="up-grid">
          <section className="card up-card">
            <h2 className="up-title">
              <span className="section-number">1</span> Which test is it?
            </h2>
            <div className="up-fields">
              <label className="upload-field">
                <span className="upload-field-label">Subject</span>
                <select
                  value={submission.subject}
                  onChange={(event) =>
                    setSubmission((current) => ({ ...current, subject: event.target.value }))
                  }
                >
                  {Object.keys(subjectTeachers).map((subject) => (
                    <option key={subject}>{subject}</option>
                  ))}
                  <option>Other</option>
                </select>
              </label>
              <label className="upload-field">
                <span className="upload-field-label">Exam name</span>
                <select
                  value={submission.examName}
                  onChange={(event) =>
                    setSubmission((current) => ({ ...current, examName: event.target.value }))
                  }
                >
                  <option>Comparing Fractions Quiz – Unit 4</option>
                  <option>Word Problems Check</option>
                  <option>Custom exam name</option>
                </select>
              </label>
              <label className="upload-field">
                <span className="upload-field-label">Language</span>
                <select
                  value={submission.language}
                  onChange={(event) =>
                    setSubmission((current) => ({
                      ...current,
                      language: event.target.value as "English" | "German",
                    }))
                  }
                >
                  <option>English</option>
                  <option>German</option>
                </select>
              </label>
              {submission.examName === "Custom exam name" && (
                <label className="upload-field custom-name-field">
                  <span className="upload-field-label">Your exam name</span>
                  <input
                    value={submission.customExamName}
                    onChange={(event) =>
                      setSubmission((current) => ({
                        ...current,
                        customExamName: event.target.value,
                      }))
                    }
                    placeholder="Type the exam name"
                  />
                </label>
              )}
            </div>
          </section>

          <section className="card up-card">
            <div className="up-pages-head">
              <h2 className="up-title">
                <span className="section-number">2</span> Your pages
                {submission.pages.length > 0 && (
                  <em className="up-count">{submission.pages.length}</em>
                )}
              </h2>
              {submission.pages.length > 0 && (
                <Button variant="secondary" onClick={() => addInputRef.current?.click()}>
                  <Icon name="plus" size={16} /> Add a page
                </Button>
              )}
            </div>
            {submission.pages.length === 0 ? (
              <>
                <button className="up-drop" onClick={() => fileInputRef.current?.click()}>
                  <span className="up-drop-icon">
                    <Icon name="upload" size={30} />
                  </span>
                  <strong>Choose your pages</strong>
                  <small>A picture or PDF of each page</small>
                </button>
              </>
            ) : (
              <div className="up-thumbs">
                <div className="page-thumbnail-grid">
                  {submission.pages.map((page, index) => (
                    <article className="page-thumbnail-card" key={page.id}>
                      <div className="page-thumbnail-preview">
                        <PaperPreview page={page} pageNumber={index + 1} compact />
                        <span className="page-number-badge">Page {index + 1}</span>
                      </div>
                      <div className="page-thumbnail-footer">
                        <span>{page.name}</span>
                        <div>
                          <button
                            aria-label={`Preview page ${index + 1}`}
                            onClick={() => review(index)}
                          >
                            <Icon name="zoom-in" size={16} />
                          </button>
                          <button
                            aria-label={`Remove page ${index + 1}`}
                            onClick={() =>
                              setSubmission((current) => {
                                const remainingPages = current.pages.filter(
                                  (item) => item.id !== page.id,
                                );
                                return {
                                  ...current,
                                  pages:
                                    remainingPages.length < 2
                                      ? remainingPages.map((item) => ({
                                          ...item,
                                          quality: "clear" as const,
                                        }))
                                      : remainingPages,
                                };
                              })
                            }
                          >
                            <Icon name="trash" size={16} />
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            )}
            <input
              ref={fileInputRef}
              className="hidden-file-input"
              type="file"
              accept="image/*,.pdf,application/pdf"
              multiple
              onChange={(event) => addFiles(event.target.files)}
            />
            <input
              ref={addInputRef}
              className="hidden-file-input"
              type="file"
              accept="image/*,.pdf,application/pdf"
              multiple
              onChange={(event) => addFiles(event.target.files)}
            />
          </section>
        </div>

        <div className="up-actions">
          <span className={validation ? "up-error" : ""} role={validation ? "alert" : undefined}>
            {validation ||
              (submission.pages.length
                ? `${submission.pages.length} ${submission.pages.length === 1 ? "page" : "pages"} added`
                : "Add at least one page to continue.")}
          </span>
          <Button
            className="kid-big-button"
            onClick={() => review()}
            disabled={
              !submission.subject || !selectedExamName.trim() || submission.pages.length === 0
            }
          >
            Check my pages <Icon name="arrow" />
          </Button>
        </div>
      </div>
    </PortalLayout>
  );
}

/** The same 3-step tracker on every "Send my test" screen. */
function SendSteps({ step }: { step: 1 | 2 | 3 | 4 }) {
  const labels = ["Add pages", "Check pages", "Send"];
  return (
    <div className="journey-steps send-steps" aria-label={`Step ${Math.min(step, 3)} of 3`}>
      {labels.map((label, index) => {
        const number = index + 1;
        const state = number < step ? "complete" : number === step ? "active" : "";
        return (
          <Fragment key={label}>
            {index > 0 && <i className={number <= step ? "complete" : ""} />}
            <span className={state}>
              <b>{state === "complete" ? <Icon name="check" size={14} /> : number}</b> {label}
            </span>
          </Fragment>
        );
      })}
    </div>
  );
}

function StudentQualityCheck({
  submission,
  setSubmission,
  onBack,
  onSubmit,
  onNavigate,
  onLogout,
  initialPageIndex,
}: {
  submission: ExamSubmission;
  setSubmission: React.Dispatch<React.SetStateAction<ExamSubmission>>;
  onBack: () => void;
  onSubmit: () => void;
  onNavigate: (label: string) => void;
  onLogout: () => void;
  initialPageIndex: number;
}) {
  const [selectedIndex, setSelectedIndex] = useState(initialPageIndex);
  const [zoom, setZoom] = useState(80);
  const replacementRef = useRef<HTMLInputElement>(null);
  const addPageRef = useRef<HTMLInputElement>(null);
  const selectedPage = submission.pages[selectedIndex];
  const hasWarning = submission.pages.some((page) => page.quality === "blurry");

  const replaceSelected = (file?: File) => {
    if (!selectedPage) return;
    setSubmission((current) => ({
      ...current,
      pages: current.pages.map((page, index) =>
        index === selectedIndex
          ? {
              ...page,
              name: file?.name ?? `Retaken page ${selectedIndex + 1}`,
              previewUrl: file?.type.startsWith("image/")
                ? URL.createObjectURL(file)
                : page.previewUrl,
              quality: "clear",
              retaken: true,
            }
          : page,
      ),
    }));
  };

  const removeSelected = () => {
    setSubmission((current) => {
      const remainingPages = current.pages.filter((_, index) => index !== selectedIndex);
      return {
        ...current,
        pages:
          remainingPages.length < 2
            ? remainingPages.map((page) => ({ ...page, quality: "clear" as const }))
            : remainingPages,
      };
    });
    setSelectedIndex((current) => Math.max(0, Math.min(current, submission.pages.length - 2)));
  };

  const pick = (index: number) => {
    setSelectedIndex(index);
    setZoom(80);
  };

  return (
    <PortalLayout role="student" active="Upload Exam" onNavigate={onNavigate} onLogout={onLogout}>
      <Topbar
        title="Check my pages"
        subtitle={`Make sure ${teacherFor(submission.subject)} can read every page.`}
        student
      />
      <div className="content up up-fit up-check">
        <SendSteps step={2} />

        <div className="qc-grid">
          <aside className="card up-card qc-pages">
            <h2 className="up-title">
              Your pages <em className="up-count">{submission.pages.length}</em>
            </h2>
            <div className="qc-list">
              {submission.pages.map((page, index) => (
                <button
                  key={page.id}
                  className={`qc-thumb ${selectedIndex === index ? "selected" : ""} ${page.quality}`}
                  onClick={() => pick(index)}
                >
                  <span className="qc-thumb-paper">
                    <PaperPreview page={page} pageNumber={index + 1} compact />
                  </span>
                  <span className="qc-thumb-text">
                    <strong>Page {index + 1}</strong>
                    <small>
                      <Icon name={page.quality === "clear" ? "check" : "flag"} size={13} />
                      {page.quality === "clear" ? "Clear" : "Blurry"}
                    </small>
                  </span>
                </button>
              ))}
            </div>
            <Button variant="secondary" onClick={() => addPageRef.current?.click()}>
              <Icon name="plus" size={16} /> Add a page
            </Button>
            <input
              ref={addPageRef}
              className="hidden-file-input"
              type="file"
              accept="image/*,.pdf,application/pdf"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                setSubmission((current) => ({
                  ...current,
                  pages: [...current.pages, ...createSubmissionPages([file], current.pages.length)],
                }));
              }}
            />
          </aside>

          <section className="card up-card qc-preview">
            {selectedPage ? (
              <>
                <div className="qc-toolbar">
                  <div className="qc-nav">
                    <button
                      aria-label="Previous page"
                      disabled={selectedIndex === 0}
                      onClick={() => pick(selectedIndex - 1)}
                    >
                      <Icon name="chevron" size={18} />
                    </button>
                    <strong>
                      Page {selectedIndex + 1} of {submission.pages.length}
                    </strong>
                    <button
                      aria-label="Next page"
                      disabled={selectedIndex === submission.pages.length - 1}
                      onClick={() => pick(selectedIndex + 1)}
                    >
                      <Icon name="chevron" size={18} />
                    </button>
                  </div>
                  <div className="zoom-controls qc-zoom">
                    <button
                      aria-label="Zoom out"
                      onClick={() => setZoom((current) => Math.max(50, current - 10))}
                    >
                      <Icon name="zoom-out" size={18} />
                    </button>
                    <span>{zoom}%</span>
                    <button
                      aria-label="Zoom in"
                      onClick={() => setZoom((current) => Math.min(140, current + 10))}
                    >
                      <Icon name="zoom-in" size={18} />
                    </button>
                  </div>
                </div>
                <div className="qc-stage">
                  <div className="large-paper-wrap" style={{ transform: `scale(${zoom / 100})` }}>
                    <PaperPreview page={selectedPage} pageNumber={selectedIndex + 1} />
                  </div>
                </div>
              </>
            ) : (
              <div className="empty-page-state">Add a page to continue.</div>
            )}
          </section>

          <aside className="card up-card qc-quality">
            <h2 className="up-title">Page {selectedPage ? selectedIndex + 1 : ""}</h2>
            {selectedPage?.quality === "blurry" ? (
              <div className="qc-status warning">
                <Icon name="flag" size={22} />
                <strong>A little blurry</strong>
                <p>
                  Upload a clearer picture so {teacherFor(submission.subject)} can read your
                  answers.
                </p>
              </div>
            ) : (
              <div className="qc-status success">
                <Icon name="check" size={22} />
                <strong>This page is clear!</strong>
                <p>{teacherFor(submission.subject)} will be able to read it.</p>
              </div>
            )}
            <div className="qc-actions">
              <Button
                variant={selectedPage?.quality === "blurry" ? "primary" : "secondary"}
                onClick={() => replacementRef.current?.click()}
                disabled={!selectedPage}
              >
                <Icon name="upload" size={17} /> Replace page
              </Button>
              <Button variant="ghost" onClick={removeSelected} disabled={!selectedPage}>
                <Icon name="trash" size={16} /> Remove page
              </Button>
            </div>
            <input
              ref={replacementRef}
              className="hidden-file-input"
              type="file"
              accept="image/*,.pdf,application/pdf"
              onChange={(event) => replaceSelected(event.target.files?.[0])}
            />
          </aside>
        </div>

        <div className="up-actions">
          <span className={hasWarning ? "up-warn" : "up-ok"}>
            <Icon name={hasWarning ? "flag" : "check"} size={18} />
            {hasWarning
              ? "One page is blurry. Replace or remove it to send."
              : "All pages look good!"}
          </span>
          <div className="up-actions-buttons">
            <Button variant="secondary" onClick={onBack}>
              Back
            </Button>
            <Button
              className="kid-big-button"
              onClick={onSubmit}
              disabled={hasWarning || submission.pages.length === 0}
            >
              Send to {teacherFor(submission.subject)} <Icon name="arrow" />
            </Button>
          </div>
        </div>
      </div>
    </PortalLayout>
  );
}

const trackerStages: { status: ExamStatus; description: string }[] = [
  { status: "Teacher checking", description: "Your teacher is checking your answers." },
  { status: "Graded", description: "Your results are ready to see." },
];

function SubmissionConfirmation({
  submission,
  onTrack,
  onHome,
  onNavigate,
  onLogout,
}: {
  submission: ExamSubmission;
  onTrack: () => void;
  onHome: () => void;
  onNavigate: (label: string) => void;
  onLogout: () => void;
}) {
  return (
    <PortalLayout role="student" active="Upload Exam" onNavigate={onNavigate} onLogout={onLogout}>
      <Topbar title="Test sent!" subtitle="Your pages are safely on their way." student />
      <div className="content up up-fit up-done">
        <SendSteps step={4} />
        <section className="card up-done-card">
          <span className="up-done-check">
            <Icon name="check" size={34} />
          </span>
          <h2>Your test is on its way to {teacherFor(submission.subject)}!</h2>
          <p>We will tell you when she has checked it.</p>
          <div className="up-done-exam">
            <Icon name="file" size={22} />
            <div>
              <strong>
                {submission.examName === "Custom exam name"
                  ? submission.customExamName
                  : submission.examName}
              </strong>
              <small>
                {submission.subject} · {submission.language} · {submission.pages.length}{" "}
                {submission.pages.length === 1 ? "page" : "pages"}
              </small>
            </div>
          </div>
          <div className="up-done-actions">
            <Button className="kid-big-button" onClick={onTrack}>
              See my results <Icon name="arrow" />
            </Button>
            <Button variant="secondary" onClick={onHome}>
              Back to Dashboard
            </Button>
          </div>
        </section>
      </div>
    </PortalLayout>
  );
}

type ReviewQuestion = {
  id: string;
  question: string;
  studentAnswer: string;
  expectedAnswer: string;
  marks: number;
  maxScore: number;
  teacherNote?: string;
};
const q = (
  id: string,
  question: string,
  studentAnswer: string,
  expectedAnswer: string,
  marks: number,
  maxScore: number,
  teacherNote?: string,
): ReviewQuestion => ({
  id,
  question,
  studentAnswer,
  expectedAnswer,
  marks,
  maxScore,
  teacherNote,
});

/** Question-by-question results for Omar's older, already-checked tests (dummy data). */
const olderTestQuestions: Record<string, { message: string; questions: ReviewQuestion[] }> = {
  "omar-fractions-unit-3": {
    message:
      "Good work on halves, Omar! Next time, draw the fraction bars before you compare. It really helps.",
    questions: [
      q("u3-1", "Colour 1/2 of the rectangle.", "Coloured 2 of 4 parts", "2 of 4 parts", 5, 5),
      q(
        "u3-2",
        "Which is larger: 1/3 or 1/4?",
        "1/4",
        "1/3",
        0,
        5,
        "Smaller bottom number means bigger pieces.",
      ),
      q("u3-3", "Write a fraction equal to 2/4.", "1/2", "1/2", 5, 5),
      q(
        "u3-4",
        "Order 2/5, 1/5 and 4/5 from least to greatest.",
        "1/5, 4/5, 2/5",
        "1/5, 2/5, 4/5",
        1,
        5,
        "You started well! Look at the tops again.",
      ),
      q(
        "u3-5",
        "Sam ate 3/8 of a pizza. How much is left?",
        "4/8",
        "5/8",
        2,
        5,
        "Good drawing, check your counting.",
      ),
    ],
  },
  "omar-english-reading": {
    message: "Lovely reading, Omar! Remember to find the answer in the text before you write it.",
    questions: [
      q("en-1", "Who is the main character in the story?", "Leo the fox", "Leo the fox", 5, 5),
      q("en-2", "Where does the story happen?", "In the forest", "In the forest", 5, 5),
      q(
        "en-3",
        "Why was Leo sad?",
        "He lost his hat",
        "He lost his red hat",
        4,
        5,
        "Add the detail: it was red.",
      ),
      q(
        "en-4",
        "Find a word that means ‘happy’.",
        "glad",
        "glad / cheerful",
        3,
        5,
        "Good! You could also say cheerful.",
      ),
    ],
  },
  "omar-german-words": {
    message: "Sehr gut, Omar! Practise the words for colours once more.",
    questions: [
      q("de-1", "Was heißt ‘dog’ auf Deutsch?", "der Hund", "der Hund", 5, 5),
      q("de-2", "Was heißt ‘house’ auf Deutsch?", "das Haus", "das Haus", 5, 5),
      q(
        "de-3",
        "Was heißt ‘blue’ auf Deutsch?",
        "blo",
        "blau",
        2,
        5,
        "Almost! It is spelled b-l-a-u.",
      ),
      q(
        "de-4",
        "Was heißt ‘apple’ auf Deutsch?",
        "der Apfel",
        "der Apfel",
        4,
        5,
        "Remember the capital A.",
      ),
      q("de-5", "Was heißt ‘red’ auf Deutsch?", "rot", "rot", 2, 5),
    ],
  },
  "omar-arabic-spelling": {
    message: "Excellent spelling, Omar! Keep reading every day.",
    questions: [
      q("ar-1", "Spell the word for ‘book’.", "كتاب", "كتاب", 4, 4),
      q("ar-2", "Spell the word for ‘school’.", "مدرسة", "مدرسة", 3, 3),
      q(
        "ar-3",
        "Spell the word for ‘pen’.",
        "قلم",
        "قلم",
        2,
        3,
        "Check the shape of the last letter.",
      ),
    ],
  },
};

function ResultsHub({
  submissions,
  selectedId,
  teacherWorkflow,
  onStartPractice,
  onSelect,
  onUpdateStatus,
  onNavigate,
  onLogout,
}: {
  submissions: ExamSubmission[];
  selectedId: string | null;
  teacherWorkflow: TeacherWorkflow;
  onStartPractice: () => void;
  onSelect: (id: string | null) => void;
  onUpdateStatus: (id: string, status: ExamStatus) => void;
  onNavigate: (label: string) => void;
  onLogout: () => void;
}) {
  const [filter, setFilter] = useState<"All" | "In Progress" | "Graded">("All");
  const [subjectTab, setSubjectTab] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const selectedExam = submissions.find((exam) => exam.id === selectedId);
  const filteredExams = submissions.filter((exam) => {
    const statusMatch =
      filter === "All" ||
      (filter === "Graded" ? exam.status === "Graded" : exam.status !== "Graded");
    const searchMatch = `${exam.examName} ${exam.subject}`
      .toLowerCase()
      .includes(query.toLowerCase());
    return statusMatch && searchMatch;
  });

  if (selectedExam) {
    const isUnitFour = selectedExam.id === teacherWorkflow.exam.id;
    const releasedUnitFour = isUnitFour && teacherWorkflow.feedback.sent;
    if (selectedExam.status === "Graded") {
      const score = selectedExam.grade ?? 52;
      const older = olderTestQuestions[selectedExam.id];
      const messageText = releasedUnitFour
        ? teacherWorkflow.feedback.message
        : (older?.message ?? "You finished this test and showed your working. Keep practising!");
      // Same shape for the live Unit 4 quiz and the older (dummy) tests.
      const reviewQuestions: ReviewQuestion[] = releasedUnitFour
        ? teacherWorkflow.gradeQuestions.map((question) => ({
            id: question.id,
            question: question.question,
            studentAnswer: question.studentAnswer,
            expectedAnswer: question.expectedAnswer,
            marks: question.finalScore ?? question.suggestedScore,
            maxScore: question.maxScore,
            teacherNote: question.teacherNote,
          }))
        : (older?.questions ?? []);
      const fullMarks = reviewQuestions.filter((question) => question.marks === question.maxScore);
      const positiveQuestions = fullMarks.length
        ? fullMarks
        : reviewQuestions.filter((question) => question.marks > 0);
      return (
        <PortalLayout role="student" active="Results" onNavigate={onNavigate} onLogout={onLogout}>
          <Topbar title="My results" subtitle="Tap a test to see what your teacher said." student />
          <div className="content student-result-page">
            <button
              className="back-to-results"
              onClick={() => {
                onSelect(null);
                setDetailsOpen(false);
              }}
            >
              <Icon name="arrow" size={16} /> Back to my results
            </button>

            <section className="kid-result-hero" style={subjectStyle(selectedExam.subject)}>
              <div className="kid-result-hero-copy">
                <span className="kid-result-subject">
                  {subjectInfo(selectedExam.subject).emoji} {selectedExam.subject}
                </span>
                <h2>{selectedExam.examName}</h2>
                <p>{(selectedExam.submittedAt ?? "").replace(/, \d{4}$/, "")}</p>
                <span className="kid-result-cheer">
                  {score >= 80
                    ? "🏆 Amazing work!"
                    : score >= 60
                      ? "👍 Good job!"
                      : "💪 Keep going!"}
                </span>
              </div>
              <div
                className="kid-score-ring"
                style={{ "--pct": `${score}%` } as React.CSSProperties}
                aria-label={`Your score ${score}%`}
              >
                <div>
                  <strong>{score}%</strong>
                  <span>Your score</span>
                </div>
              </div>
            </section>

            <div className="kid-result-tabs" role="tablist">
              <button
                role="tab"
                aria-selected={!detailsOpen}
                className={!detailsOpen ? "active" : ""}
                onClick={() => setDetailsOpen(false)}
              >
                💬 {teacherFor(selectedExam.subject)} says
              </button>
              <button
                role="tab"
                aria-selected={detailsOpen}
                className={detailsOpen ? "active" : ""}
                onClick={() => setDetailsOpen(true)}
              >
                📋 Every question
                {reviewQuestions.length > 0 && <em>{reviewQuestions.length}</em>}
              </button>
            </div>

            {!detailsOpen && (
              <>
                <section className="card kid-message">
                  <span className="teacher-message-avatar">
                    {teacherInitials(selectedExam.subject)}
                  </span>
                  <div className="kid-message-copy">
                    <h3>{teacherFor(selectedExam.subject)} says</h3>
                    <p>{messageText}</p>
                    <ReadAloud
                      text={`${teacherFor(selectedExam.subject)} says: ${messageText}`}
                      lang={speechLang(selectedExam.language)}
                    />
                  </div>
                </section>

                {releasedUnitFour &&
                  teacherWorkflow.feedback.sendPractice &&
                  teacherWorkflow.feedback.questions.length > 0 && (
                    <section className="kid-result-next">
                      <span className="student-next-step-icon">
                        <Icon name="practice" size={28} />
                      </span>
                      <div>
                        <span className="kid-next-kicker">Next up</span>
                        <h3>Let’s practise {teacherWorkflow.gap.topic.toLowerCase()}</h3>
                        <p>
                          {teacherWorkflow.feedback.questions.length} questions picked for you by
                          Ms. Nadia.
                        </p>
                      </div>
                      <Button className="kid-big-button" onClick={onStartPractice}>
                        Start practice <Icon name="arrow" />
                      </Button>
                    </section>
                  )}

                <section className="card kid-well">
                  <h3>
                    <Icon name="check" size={18} /> What you did well
                  </h3>
                  {positiveQuestions.length > 0 ? (
                    <ul>
                      {positiveQuestions.map((question) => (
                        <li key={question.id}>{question.question}</li>
                      ))}
                    </ul>
                  ) : (
                    <p>You finished every page and showed your working.</p>
                  )}
                </section>
              </>
            )}

            <section className="card student-question-review" hidden={!detailsOpen}>
              {detailsOpen && (
                <div className="student-question-review-list">
                  {reviewQuestions.length ? (
                    reviewQuestions.map((question, index) => {
                      const marks = question.marks;
                      return (
                        <article
                          key={question.id}
                          className={`student-question-result ${
                            marks === question.maxScore ? "full" : "none"
                          }`}
                        >
                          <div className="student-question-result-head">
                            <strong>Question {index + 1}</strong>
                            <em className="kid-verdict">
                              {marks === question.maxScore ? "✅ Right" : "❌ Wrong"}
                            </em>
                            <span>
                              {marks}/{question.maxScore} marks
                            </span>
                          </div>
                          <h4 className="student-question-title">{question.question}</h4>
                          <div className="student-answer-grid">
                            <div>
                              <span>Your answer</span>
                              <p>{question.studentAnswer}</p>
                            </div>
                            <div>
                              <span>Correct answer</span>
                              <p>{question.expectedAnswer}</p>
                            </div>
                          </div>
                          {question.teacherNote && (
                            <p className="student-teacher-note">
                              {teacherFor(selectedExam.subject)}: {question.teacherNote}
                            </p>
                          )}
                        </article>
                      );
                    })
                  ) : (
                    <div className="student-older-detail">
                      There are no question details for this test.
                    </div>
                  )}
                </div>
              )}
            </section>
          </div>
        </PortalLayout>
      );
    }

    const teacherName = teacherFor(selectedExam.subject);
    return (
      <PortalLayout role="student" active="Results" onNavigate={onNavigate} onLogout={onLogout}>
        <Topbar title="My results" subtitle="Tap a test to see what your teacher said." student />
        <div className="content kid-results">
          <button
            className="back-to-results"
            onClick={() => {
              onSelect(null);
              setDetailsOpen(false);
            }}
          >
            <Icon name="arrow" size={16} /> Back to my results
          </button>
          <section className="card kid-wait" style={subjectStyle(selectedExam.subject)}>
            <span className="kid-wait-icon" aria-hidden="true">
              <Icon name="clock" size={34} />
            </span>
            <small>
              {subjectInfo(selectedExam.subject).emoji} {selectedExam.subject} ·{" "}
              {(selectedExam.submittedAt ?? "").replace(/, \d{4}$/, "")}
            </small>
            <h2>{selectedExam.examName}</h2>
            <p>{teacherName} is checking your test. We will tell you when it is ready.</p>
            <div className="kid-wait-steps" aria-label="Where is my test?">
              <span className="current">
                <b>1</b> {teacherName} is checking
              </span>
              <i />
              <span>
                <b>2</b> Checked
              </span>
            </div>
          </section>
        </div>
      </PortalLayout>
    );
  }

  const friendlyStatus = (exam: ExamSubmission) =>
    exam.status === "Graded"
      ? exam.id === teacherWorkflow.exam.id
        ? "New result!"
        : "See my result"
      : `${teacherFor(exam.subject)} is checking`;
  // One chip per subject, so each teacher's tests stay together. Works for any number of subjects.
  const subjectList = Array.from(
    new Set([...Object.keys(subjectTeachers), ...submissions.map((exam) => exam.subject)]),
  );
  const countIn = (subject: string) =>
    submissions.filter((exam) => exam.subject === subject).length;
  const readyIn = (subject: string) =>
    submissions.filter(
      (exam) =>
        exam.subject === subject && exam.status === "Graded" && exam.id === teacherWorkflow.exam.id,
    ).length;
  const activeSubject =
    subjectTab && subjectList.includes(subjectTab)
      ? subjectTab
      : (subjectList.find((subject) => readyIn(subject) > 0) ??
        subjectList.find((subject) => countIn(subject) > 0) ??
        subjectList[0]);
  const inSubject = submissions.filter((exam) => exam.subject === activeSubject);
  const isNew = (exam: ExamSubmission) =>
    exam.status === "Graded" && exam.id === teacherWorkflow.exam.id;
  const sorted = [
    ...inSubject.filter(isNew),
    ...inSubject.filter((exam) => exam.status === "Graded" && !isNew(exam)),
    ...inSubject.filter((exam) => exam.status !== "Graded"),
  ];
  const active = subjectInfo(activeSubject);
  return (
    <PortalLayout role="student" active="Results" onNavigate={onNavigate} onLogout={onLogout}>
      <Topbar title="My results" subtitle="Pick a subject, then tap a test." student />
      <div className="content results-content kid-results">
        <div className="kid-subject-chips" role="tablist" aria-label="Subjects">
          {subjectList.map((subject) => {
            const count = countIn(subject);
            const ready = readyIn(subject);
            return (
              <button
                key={subject}
                role="tab"
                aria-selected={subject === activeSubject}
                style={subjectStyle(subject)}
                className={`kid-subject-chip ${subject === activeSubject ? "active" : ""} ${count ? "" : "empty"}`}
                onClick={() => setSubjectTab(subject)}
              >
                <span className="kid-subject-emoji" aria-hidden="true">
                  {subjectInfo(subject).emoji}
                </span>
                <span className="kid-subject-name">{subject}</span>
                {ready > 0 ? <em className="new">New</em> : count > 0 && <em>{count}</em>}
              </button>
            );
          })}
        </div>

        <div className="kid-subject-header" style={subjectStyle(activeSubject)}>
          <span className="kid-subject-emoji big" aria-hidden="true">
            {active.emoji}
          </span>
          <div>
            <strong>{activeSubject}</strong>
            <small>
              with {active.full} · {inSubject.length} test{inSubject.length === 1 ? "" : "s"}
            </small>
          </div>
        </div>

        {sorted.length === 0 && (
          <div className="kid-subject-empty">
            No {activeSubject} tests yet. When you send one, it will show up here.
          </div>
        )}
        {sorted.map((exam) => (
          <button
            className={`kid-result-row ${isNew(exam) ? "ready new" : exam.status === "Graded" ? "ready" : "waiting"}`}
            key={exam.id}
            onClick={() => onSelect(exam.id)}
          >
            <span className="kid-result-icon" aria-hidden="true">
              <Icon name={exam.status === "Graded" ? "results" : "clock"} size={24} />
            </span>
            <span className="kid-result-name">
              <strong>{exam.examName}</strong>
              <small>
                {exam.language === "German" ? "In German · " : ""}
                {(exam.submittedAt ?? "").replace(/, \d{4}$/, "")}
              </small>
            </span>
            <span className="kid-result-status">{friendlyStatus(exam)}</span>
            <Icon name="chevron" size={20} />
          </button>
        ))}
      </div>
    </PortalLayout>
  );
}

/**
 * A ready-made Mathematics practice, always available to Omar.
 * It lets the student side be tested without going through the teacher's screens first.
 * When Ms. Nadia sends targeted practice (T6), that practice replaces this one.
 */
const mathWarmUp: PracticeQuestion[] = [
  {
    id: "warm-1",
    text: "Which is larger: 3/4 or 2/3?",
    check: "auto",
    answer: "3/4",
    accepted: [],
    answerSource: "teacher",
    hint: "Think of 12 pieces: 3/4 is 9 pieces and 2/3 is 8 pieces.",
    reason: "3/4 = 9/12 and 2/3 = 8/12.",
  },
  {
    id: "warm-2",
    text: "Use >, < or = to compare 2/5 and 4/10.",
    check: "auto",
    answer: "2/5 = 4/10",
    accepted: ["equal", "same"],
    answerSource: "teacher",
    hint: "Double the top and bottom of 2/5.",
    reason: "2/5 is the same as 4/10.",
  },
  {
    id: "warm-3",
    text: "Lina ate 2/8 of a pizza and Adam ate 1/2. Who ate more?",
    check: "auto",
    answer: "Adam",
    accepted: [],
    answerSource: "teacher",
    hint: "1/2 is the same as 4/8.",
    reason: "1/2 = 4/8, which is more than 2/8.",
  },
  {
    id: "warm-4",
    text: "Order 1/2, 1/5 and 3/4 from least to greatest.",
    check: "auto",
    answer: "1/5, 1/2, 3/4",
    accepted: ["1/5 1/2 3/4"],
    answerSource: "teacher",
    hint: "Which one is less than a half? Which one is more than a half?",
  },
  {
    id: "warm-5",
    text: "What is 1/4 + 1/4?",
    check: "auto",
    answer: "1/2",
    accepted: ["2/4"],
    answerSource: "teacher",
    hint: "Two quarters of a pizza make…",
    reason: "1/4 + 1/4 = 2/4, which is the same as 1/2.",
  },
];

type PracticeSet = {
  id: string;
  subject: string;
  title: string;
  questions: PracticeQuestion[];
  /** Score from an earlier try (dummy history). */
  past?: { correct: number; total: number; date: string };
};
const auto = (id: string, text: string, answer: string, hint: string, accepted: string[] = []) =>
  ({
    id,
    text,
    check: "auto",
    answer,
    accepted,
    answerSource: "teacher",
    hint,
  }) as PracticeQuestion;

/** Omar's Mathematics practice: the warm-up (ready now) and three he did before. */
const mathPracticeSets: PracticeSet[] = [
  { id: "math-warm-up", subject: "Mathematics", title: "Fractions warm-up", questions: mathWarmUp },
  {
    id: "math-fraction-words",
    subject: "Mathematics",
    title: "Fraction word problems",
    past: { correct: 5, total: 6, date: "May 15" },
    questions: [
      auto(
        "fw-1",
        "Sara ate 1/3 of a cake and Ali ate 1/6. Who ate more?",
        "Sara",
        "1/3 is the same as 2/6.",
      ),
      auto("fw-2", "Which is larger: 1/2 or 2/5?", "1/2", "2/5 is less than half of 5."),
      auto("fw-3", "Use >, < or = to compare 3/6 and 1/2.", "3/6 = 1/2", "3 is half of 6.", [
        "equal",
      ]),
      auto("fw-4", "What is 1/5 + 2/5?", "3/5", "Add the tops, keep the bottom."),
      auto(
        "fw-5",
        "Omar ate 3/8 of a pie and Mona ate 1/4. Who ate more?",
        "Omar",
        "1/4 is the same as 2/8.",
      ),
      auto("fw-6", "Which is larger: 5/8 or 1/2?", "5/8", "1/2 is the same as 4/8."),
    ],
  },
  {
    id: "math-equivalent",
    subject: "Mathematics",
    title: "Equivalent fractions",
    past: { correct: 8, total: 10, date: "Apr 30" },
    questions: [
      auto(
        "eq-1",
        "Use >, < or = to compare 1/2 and 2/4.",
        "1/2 = 2/4",
        "Double the top and bottom of 1/2.",
        ["equal"],
      ),
      auto("eq-2", "Which is larger: 2/3 or 4/6?", "equal", "Double the top and bottom of 2/3.", [
        "same",
      ]),
      auto(
        "eq-3",
        "What is 1/3 written with a bottom number of 6?",
        "2/6",
        "Multiply top and bottom by 2.",
      ),
      auto(
        "eq-4",
        "Use >, < or = to compare 3/4 and 6/8.",
        "3/4 = 6/8",
        "Double the top and bottom of 3/4.",
        ["equal"],
      ),
      auto(
        "eq-5",
        "Use >, < or = to compare 1/5 and 2/10.",
        "1/5 = 2/10",
        "Double the top and bottom of 1/5.",
        ["equal"],
      ),
      auto(
        "eq-6",
        "What is 1/2 written with a bottom number of 10?",
        "5/10",
        "Multiply top and bottom by 5.",
      ),
      auto("eq-7", "Which is larger: 3/5 or 6/10?", "equal", "Double the top and bottom of 3/5.", [
        "same",
      ]),
      auto(
        "eq-8",
        "Use >, < or = to compare 2/3 and 3/6.",
        "2/3 > 3/6",
        "3/6 is one half. Is 2/3 more than a half?",
      ),
      auto(
        "eq-9",
        "What is 2/4 written with a bottom number of 2?",
        "1/2",
        "Divide top and bottom by 2.",
      ),
      auto("eq-10", "Use >, < or = to compare 4/8 and 1/2.", "4/8 = 1/2", "4 is half of 8.", [
        "equal",
      ]),
    ],
  },
  {
    id: "math-halves",
    subject: "Mathematics",
    title: "Halves and quarters",
    past: { correct: 6, total: 8, date: "Apr 10" },
    questions: [
      auto(
        "hq-1",
        "Which is larger: 1/2 or 1/4?",
        "1/2",
        "Cut a pizza in 2 or in 4: which slice is bigger?",
      ),
      auto("hq-2", "What is 1/4 + 1/4 + 1/4 + 1/4?", "1", "Four quarters make a whole.", ["4/4"]),
      auto(
        "hq-3",
        "Use >, < or = to compare 2/4 and 1/2.",
        "2/4 = 1/2",
        "Two quarters make a half.",
        ["equal"],
      ),
      auto("hq-4", "How many quarters are in one half?", "2", "Two quarters make a half.", ["two"]),
      auto("hq-5", "What is 1/2 + 1/2?", "1", "Two halves make a whole.", ["2/2", "one"]),
      auto("hq-6", "Which is larger: 3/4 or 1/2?", "3/4", "1/2 is the same as 2/4."),
      auto("hq-7", "How many halves make a whole?", "2", "Cut a pizza in half: how many pieces?", [
        "two",
      ]),
      auto(
        "hq-8",
        "Use >, < or = to compare 1/4 and 1/2.",
        "1/4 < 1/2",
        "A quarter is smaller than a half.",
      ),
    ],
  },
];

/** Big, friendly score: stars plus "3 of 4". */
function PracticeScore({
  correct,
  total,
  big = false,
}: {
  correct: number;
  total: number;
  big?: boolean;
}) {
  const ratio = total ? correct / total : 0;
  const tone = ratio >= 0.8 ? "great" : ratio >= 0.5 ? "good" : "try";
  return (
    <span
      className={`kid-score ${tone} ${big ? "big" : ""}`}
      aria-label={`${correct} out of ${total} right`}
    >
      <span className="kid-score-icon" aria-hidden="true">
        {tone === "great" ? "🏆" : tone === "good" ? "👍" : "💪"}
      </span>
      <b>
        {correct}/{total}
      </b>
    </span>
  );
}

/** Questions that compare two things get big tap buttons instead of typing. */
function choicesFor(text: string): { label: string; value: string }[] | null {
  const fraction = "(\\d+\\/\\d+)";
  const larger = text.match(
    new RegExp(`Which is (?:larger|bigger)[^\\d]*${fraction} or ${fraction}`, "i"),
  );
  if (larger)
    return [
      { label: larger[1], value: larger[1] },
      { label: larger[2], value: larger[2] },
      { label: "They are equal", value: "equal" },
    ];
  const signs = text.match(new RegExp(`[<>=].*compare ${fraction} and ${fraction}`, "i"));
  if (signs)
    return [">", "<", "="].map((sign) => ({
      label: `${signs[1]} ${sign} ${signs[2]}`,
      value: `${signs[1]} ${sign} ${signs[2]}`,
    }));
  const who = text.match(/([A-Z][a-z]+) ate .*? and ([A-Z][a-z]+) ate .*?Who ate more/);
  if (who)
    return [
      { label: who[1], value: who[1] },
      { label: who[2], value: who[2] },
      { label: "The same", value: "same" },
    ];
  return null;
}

function StudentPractice({
  workflow,
  practiceResult: teacherResult,
  onComplete,
  runs,
  onRunComplete,
  setId,
  onSetId,
  onNavigate,
  onLogout,
}: {
  workflow: TeacherWorkflow;
  practiceResult: PracticeResult | null;
  onComplete: (result: PracticeResult) => void;
  /** Latest result of each student-only practice set. */
  runs: Record<string, PracticeResult>;
  onRunComplete: (setId: string, result: PracticeResult) => void;
  setId: string | null;
  onSetId: (setId: string) => void;
  onNavigate: (label: string) => void;
  onLogout: () => void;
}) {
  // Targeted practice sent by the teacher comes first; otherwise the ready-made warm-up.
  const teacherReady =
    workflow.feedback.sent &&
    workflow.feedback.sendPractice &&
    workflow.feedback.questions.length > 0;
  const teacherSet: PracticeSet | null = teacherReady
    ? {
        id: "teacher",
        subject: workflow.exam.subject,
        title: workflow.gap.topic,
        questions: workflow.feedback.questions,
      }
    : null;
  const allSets = teacherSet ? [teacherSet, ...mathPracticeSets] : mathPracticeSets;
  const activeSet = allSets.find((set) => set.id === setId) ?? allSets[0];
  const fromTeacher = activeSet.id === "teacher";
  const practiceSubject = workflow.exam.subject;
  const [subject, setSubject] = useState(practiceSubject);
  const practiceAvailable = subject === practiceSubject;
  const resultOf = (set: PracticeSet) =>
    set.id === "teacher" ? teacherResult : (runs[set.id] ?? null);
  const practiceResult = resultOf(activeSet);
  const topic = activeSet.title;
  /** Latest score of a set: this session's try, or the earlier one. */
  const scoreOf = (set: PracticeSet) => {
    const result = resultOf(set);
    if (result?.completed)
      return {
        correct: result.finalCorrect ?? result.correct,
        total: result.reviewed || set.id !== "teacher" ? result.total : result.checkedTotal,
        date: "Today",
      };
    return set.past ?? null;
  };
  const [stage, setStage] = useState<"start" | "question" | "finish">("start");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [answers, setAnswers] = useState<string[]>([]);
  const [correct, setCorrect] = useState(0);
  const [saved, setSaved] = useState(0);
  const [records, setRecords] = useState<PracticeAnswerRecord[]>([]);
  const [tries, setTries] = useState(0);
  const [feedback, setFeedback] = useState<{
    type: "correct" | "hint" | "answer" | "saved";
    text: string;
  } | null>(null);
  const questions = activeSet.questions;
  const currentQuestion = questions[questionIndex];
  const checkedTotal = questions.filter((question) => question.check === "auto").length;
  const locked =
    feedback?.type === "correct" || feedback?.type === "answer" || feedback?.type === "saved";

  const normalizeAnswer = (value: string) =>
    value
      .toLowerCase()
      .replace(/[.!?,]/g, " ")
      .replace(/\b(is|the|answer|it's|its)\b/g, " ")
      .replace(/\s+/g, "")
      .trim();

  const beginPractice = () => {
    setStage("question");
    setQuestionIndex(0);
    setAnswer("");
    setAnswers([]);
    setCorrect(0);
    setSaved(0);
    setRecords([]);
    setTries(0);
    setFeedback(null);
  };
  const record = (result: Partial<PracticeAnswerRecord>) =>
    setRecords((current) => {
      const next = [...current];
      next[questionIndex] = {
        questionId: currentQuestion.id,
        question: currentQuestion.text,
        answer: answer.trim(),
        check: currentQuestion.check,
        modelAnswer: currentQuestion.answer,
        ...result,
      };
      return next;
    });

  const checkAnswer = () => {
    if (!answer.trim()) return;
    const nextAnswers = [...answers];
    nextAnswers[questionIndex] = answer.trim();
    setAnswers(nextAnswers);
    if (currentQuestion.check === "teacher") {
      setSaved((value) => value + 1);
      record({});
      setFeedback({ type: "saved", text: "Saved! Ms. Nadia will check this one." });
      return;
    }
    const candidate = normalizeAnswer(answer);
    const expected = [currentQuestion.answer, ...currentQuestion.accepted].map(normalizeAnswer);
    // The answer must match one of the teacher-confirmed answers (small wording changes allowed).
    const saysEqual = (value: string) => /=|equal|same/.test(value);
    const isCorrect =
      ((candidate === "equal" || candidate === "same") && expected.some(saysEqual)) ||
      expected.some(
        (option) => option.length > 0 && (candidate === option || candidate.startsWith(option)),
      );
    const reason = currentQuestion.reason ? ` ${currentQuestion.reason}` : "";
    if (isCorrect) {
      setCorrect((value) => value + 1);
      record({ correct: true });
      setFeedback({ type: "correct", text: `Yes! You checked the size of the pieces.${reason}` });
    } else if (tries === 0) {
      setTries(1);
      setFeedback({
        type: "hint",
        text: `Not yet. Here’s a tip: ${currentQuestion.hint ?? "read the question again slowly."} Try once more!`,
      });
    } else {
      record({ correct: false });
      setFeedback({
        type: "answer",
        text: `Good try! The answer is ${currentQuestion.answer}.${reason} You’ll get the next one.`,
      });
    }
  };

  const nextQuestion = () => {
    if (questionIndex === questions.length - 1) {
      const result: PracticeResult = {
        completed: true,
        correct,
        total: questions.length,
        checkedTotal,
        savedForTeacher: saved,
        completedAt: "Today",
        answers,
        items: records,
        reviewed: saved === 0,
        finalCorrect: saved === 0 ? correct : undefined,
      };
      if (fromTeacher) onComplete(result);
      else onRunComplete(activeSet.id, result);
      setStage("finish");
      return;
    }
    setQuestionIndex((value) => value + 1);
    setAnswer("");
    setTries(0);
    setFeedback(null);
  };

  const chips = (
    <div className="kid-subject-chips practice-chips" role="tablist" aria-label="Subjects">
      {Object.keys(subjectTeachers).map((name) => {
        const ready = name === practiceSubject;
        return (
          <button
            key={name}
            role="tab"
            aria-selected={name === subject}
            style={subjectStyle(name)}
            className={`kid-subject-chip ${name === subject ? "active" : ""} ${ready ? "" : "empty"}`}
            onClick={() => setSubject(name)}
          >
            <span className="kid-subject-emoji" aria-hidden="true">
              {subjectInfo(name).emoji}
            </span>
            <span className="kid-subject-name">{name}</span>
            {ready && (
              <em className={practiceResult?.completed ? "" : "new"}>
                {practiceResult?.completed ? "Done" : "Ready"}
              </em>
            )}
          </button>
        );
      })}
    </div>
  );

  if (!practiceAvailable) {
    return (
      <PortalLayout role="student" active="Practice" onNavigate={onNavigate} onLogout={onLogout}>
        <Topbar title="Practice" subtitle="Pick a subject to practise." student />
        <div className="content kid-practice-page">
          {chips}
          <section className="card student-friendly-empty kid-practice-empty">
            <span
              className="kid-subject-emoji big"
              style={subjectStyle(subject)}
              aria-hidden="true"
            >
              {subjectInfo(subject).emoji}
            </span>
            <h2>No {subject} practice right now</h2>
            <p>{teacherFor(subject)} will add some here when it helps you.</p>
            <Button variant="secondary" onClick={() => setSubject(practiceSubject)}>
              Go to {practiceSubject} practice <Icon name="arrow" />
            </Button>
          </section>
        </div>
      </PortalLayout>
    );
  }

  if (stage === "start") {
    return (
      <PortalLayout role="student" active="Practice" onNavigate={onNavigate} onLogout={onLogout}>
        <Topbar title="Practice" subtitle="Pick a subject to practise." student />
        <div className="content kid-practice-page">
          {chips}
          <section className="student-practice-start">
            <span className="student-practice-hero-icon">
              <Icon name="practice" size={31} />
            </span>
            <h2>{topic}</h2>
            <p>
              {fromTeacher
                ? `${teacherFor(practiceSubject)} picked these questions for you.`
                : activeSet.id === "math-warm-up"
                  ? `A quick ${practiceSubject} warm-up from ${teacherFor(practiceSubject)}.`
                  : `${practiceSubject} practice from ${teacherFor(practiceSubject)}. Can you beat last time?`}
            </p>
            <p className="kid-practice-facts">
              {questions.length} questions · about {fromTeacher ? 10 : 5} minutes · you can try each
              one twice
            </p>
            {!fromTeacher && scoreOf(activeSet) && (
              <div className="kid-last-score">
                <span>Last time ({scoreOf(activeSet)!.date})</span>
                <PracticeScore
                  correct={scoreOf(activeSet)!.correct}
                  total={scoreOf(activeSet)!.total}
                  big
                />
              </div>
            )}
            {fromTeacher && practiceResult?.completed && (
              <div className="student-prior-practice">
                {practiceResult.reviewed
                  ? `Last time: ${practiceResult.finalCorrect} of ${practiceResult.total} right, checked by Ms. Nadia`
                  : `Last time: ${practiceResult.correct} of ${practiceResult.checkedTotal} right · Ms. Nadia is checking ${practiceResult.savedForTeacher} more`}
              </div>
            )}
            {practiceResult?.reviewed &&
              practiceResult.items.some((item) => item.check === "teacher") && (
                <div className="student-teacher-review">
                  <strong>Ms. Nadia checked your answers</strong>
                  {practiceResult.items
                    .filter((item) => item.check === "teacher")
                    .map((item) => (
                      <div
                        key={item.questionId}
                        className={`student-review-item ${item.teacherMark}`}
                      >
                        <Icon name={item.teacherMark === "correct" ? "check" : "spark"} size={16} />
                        <div>
                          <b>{item.question}</b>
                          <span>
                            {item.teacherMark === "correct"
                              ? "Great answer!"
                              : "Let’s look at this one again."}
                            {item.teacherComment ? ` “${item.teacherComment}”` : ""}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            <Button className="kid-big-button" onClick={beginPractice}>
              {scoreOf(activeSet) ? "Practise again" : "Let’s start"} <Icon name="arrow" />
            </Button>
          </section>

          <section className="card kid-practice-list">
            <h3>My {practiceSubject} practice</h3>
            {allSets
              .filter((set) => set.id !== activeSet.id)
              .map((set) => {
                const score = scoreOf(set);
                return (
                  <div className="kid-practice-row" key={set.id}>
                    <span className="kid-practice-row-icon" aria-hidden="true">
                      <Icon name="practice" size={20} />
                    </span>
                    <span className="kid-practice-row-name">
                      <strong>{set.title}</strong>
                      <small>
                        {set.questions.length} questions
                        {score ? ` · ${score.date}` : " · New"}
                      </small>
                    </span>
                    {score ? (
                      <PracticeScore correct={score.correct} total={score.total} />
                    ) : (
                      <em className="kid-practice-new">Ready</em>
                    )}
                    <Button
                      variant="secondary"
                      onClick={() => {
                        onSetId(set.id);
                        beginPractice();
                      }}
                    >
                      {score ? "Practise again" : "Start"}
                    </Button>
                  </div>
                );
              })}
          </section>
        </div>
      </PortalLayout>
    );
  }

  const newBadges = (fromTeacher ? badgeDefinitions : [])
    .filter(
      (badge) =>
        (badge.id === "explorer" && true) ||
        (badge.id === "sharp" && checkedTotal > 0 && correct === checkedTotal),
    )
    .map((badge) => ({
      ...badge,
      title: badge.id === "explorer" ? explorerTitle(topic) : badge.title,
    }));

  if (stage === "finish") {
    return (
      <PortalLayout role="student" active="Practice" onNavigate={onNavigate} onLogout={onLogout}>
        <Topbar
          title="Practice complete"
          subtitle="You kept going and finished every question."
          student
        />
        <div className="content student-practice-wrap">
          <section className="student-practice-finish">
            <span className="student-finish-icon">
              <Icon name="check" size={32} />
            </span>
            <h2>You did it!</h2>
            {saved === 0 && <PracticeScore correct={correct} total={checkedTotal} big />}
            <p>
              You got {correct} of {checkedTotal} right
              {saved > 0
                ? `, and ${saved} answer${saved > 1 ? "s are" : " is"} saved for Ms. Nadia. She’ll let you know when she has checked ${saved > 1 ? "them" : "it"}`
                : ""}
              .
            </p>
            {newBadges.map((badge) => (
              <div className="student-earned-badge" key={badge.id}>
                <Icon name={badge.icon} size={24} />
                <div>
                  <span>NEW BADGE</span>
                  <strong>{badge.title}</strong>
                </div>
              </div>
            ))}
            <div className="student-finish-actions">
              <Button onClick={beginPractice}>
                Practise again <Icon name="arrow" />
              </Button>
              <Button variant="secondary" onClick={() => setStage("start")}>
                More practice
              </Button>
            </div>
          </section>
        </div>
      </PortalLayout>
    );
  }

  const progress = ((questionIndex + 1) / questions.length) * 100;
  const choices = currentQuestion.check === "auto" ? choicesFor(currentQuestion.text) : null;
  return (
    <PortalLayout role="student" active="Practice" onNavigate={onNavigate} onLogout={onLogout}>
      <Topbar title={topic} subtitle="Take your time. You can try again." student />
      <div className="content student-practice-question-wrap">
        <section className="student-practice-progress">
          <div>
            <strong>
              Question {questionIndex + 1} of {questions.length}
            </strong>
          </div>
          <div className="student-practice-progress-track">
            <i style={{ width: `${progress}%` }} />
          </div>
        </section>
        <section className="card student-practice-question">
          <span className="student-question-number">{questionIndex + 1}</span>
          <h2>{currentQuestion.text}</h2>
          <ReadAloud text={currentQuestion.text} lang={speechLang(workflow.exam.language)} />
          {currentQuestion.check === "teacher" && (
            <p className="student-question-note">Ms. Nadia will read this answer herself.</p>
          )}
          {choices ? (
            <div className="kid-choices" role="radiogroup" aria-label="Choose your answer">
              {choices.map((choice) => (
                <button
                  key={choice.value}
                  role="radio"
                  aria-checked={answer === choice.value}
                  disabled={locked}
                  className={`kid-choice ${answer === choice.value ? "picked" : ""} ${
                    answer === choice.value && feedback?.type === "correct"
                      ? "right"
                      : answer === choice.value && feedback?.type === "answer"
                        ? "wrong"
                        : ""
                  }`}
                  onClick={() => {
                    setAnswer(choice.value);
                    if (feedback?.type === "hint") setFeedback(null);
                  }}
                >
                  {choice.label}
                </button>
              ))}
            </div>
          ) : (
            <label className="student-answer-box">
              <span>Your answer</span>
              <textarea
                value={answer}
                disabled={locked}
                onChange={(event) => {
                  setAnswer(event.target.value);
                  if (feedback?.type === "hint") setFeedback(null);
                }}
                placeholder="Type your answer here…"
              />
            </label>
          )}
          {feedback && (
            <div className={`student-answer-feedback ${feedback.type}`}>
              <Icon
                name={
                  feedback.type === "correct"
                    ? "check"
                    : feedback.type === "hint"
                      ? "spark"
                      : "message"
                }
              />
              <span>{feedback.text}</span>
            </div>
          )}
          <div className="student-question-actions">
            {!locked ? (
              <Button disabled={!answer.trim()} onClick={checkAnswer}>
                Check my answer <Icon name="check" />
              </Button>
            ) : (
              <Button onClick={nextQuestion}>
                {questionIndex === questions.length - 1 ? "Finish practice" : "Next question"}{" "}
                <Icon name="arrow" />
              </Button>
            )}
          </div>
        </section>
      </div>
    </PortalLayout>
  );
}

function StudentProgress({
  workflow,
  practiceResult,
  runs,
  onOpenPractice,
  submissions,
  onNavigate,
  onLogout,
}: {
  workflow: TeacherWorkflow;
  practiceResult: PracticeResult | null;
  runs: Record<string, PracticeResult>;
  onOpenPractice: (setId: string) => void;
  submissions: ExamSubmission[];
  onNavigate: (label: string) => void;
  onLogout: () => void;
}) {
  // Every subject's checked tests, oldest first.
  const history = liveSubjectHistory(workflow);
  otherSubjectResults.forEach((exam) => {
    history[exam.subject] = [
      ...(history[exam.subject] ?? []),
      {
        examId: exam.id,
        title: exam.examName,
        date: (exam.submittedAt ?? "").replace(/, \d{4}$/, ""),
        score: exam.grade ?? 0,
      },
    ];
  });
  const subjects = Array.from(new Set([...Object.keys(subjectTeachers), ...Object.keys(history)]));
  const [subject, setSubject] = useState(workflow.exam.subject);
  const exams = history[subject] ?? [];
  const latest = exams[exams.length - 1];
  const previous = exams[exams.length - 2];
  const info = subjectInfo(subject);

  const message = !latest
    ? { icon: "📭", text: `No ${subject} results yet.` }
    : !previous
      ? { icon: "🎉", text: `Your first ${subject} result is in!` }
      : latest.score > previous.score
        ? { icon: "🌱", text: "You did better than last time!" }
        : latest.score < previous.score
          ? { icon: "💪", text: "A little lower than last time. Practice will help!" }
          : { icon: "⭐", text: "Steady work. Keep going!" };

  // Practice for this subject: teacher-picked (if any), the warm-up and earlier practice.
  const teacherReady =
    workflow.feedback.sent &&
    workflow.feedback.sendPractice &&
    workflow.feedback.questions.length > 0;
  const practiceHere = subject === workflow.exam.subject;
  const sets: PracticeSet[] = [
    ...(teacherReady
      ? [
          {
            id: "teacher",
            subject: workflow.exam.subject,
            title: workflow.gap.topic,
            questions: workflow.feedback.questions,
          },
        ]
      : []),
    ...mathPracticeSets,
  ];
  const scoreOf = (set: PracticeSet) => {
    const result = set.id === "teacher" ? practiceResult : runs[set.id];
    if (result?.completed) {
      if (set.id === "teacher" && !result.reviewed)
        return {
          correct: result.correct,
          total: result.checkedTotal,
          date: "Today",
          checking: true,
        };
      return { correct: result.finalCorrect ?? result.correct, total: result.total, date: "Today" };
    }
    return set.past ?? null;
  };

  return (
    <PortalLayout role="student" active="Progress" onNavigate={onNavigate} onLogout={onLogout}>
      <Topbar title="My progress" subtitle="Pick a subject to see how you are growing." student />
      <div className="content kid-progress">
        <div className="kid-subject-chips" role="tablist" aria-label="Subjects">
          {subjects.map((name) => {
            const count = (history[name] ?? []).length;
            return (
              <button
                key={name}
                role="tab"
                aria-selected={name === subject}
                style={subjectStyle(name)}
                className={`kid-subject-chip ${name === subject ? "active" : ""} ${count ? "" : "empty"}`}
                onClick={() => setSubject(name)}
              >
                <span className="kid-subject-emoji" aria-hidden="true">
                  {subjectInfo(name).emoji}
                </span>
                <span className="kid-subject-name">{name}</span>
              </button>
            );
          })}
        </div>

        <section className="kid-progress-hero" style={subjectStyle(subject)}>
          <span className="kid-progress-hero-icon" aria-hidden="true">
            {message.icon}
          </span>
          <div>
            <small>
              {info.emoji} {subject} · {info.name}
            </small>
            <h2>{message.text}</h2>
          </div>
        </section>

        <div className="kid-progress-grid">
          <section className="card kid-progress-chart" style={subjectStyle(subject)}>
            <h3>📊 My {subject} tests</h3>
            {exams.length ? (
              <div className="kid-bars">
                {exams.map((exam, index) => (
                  <div
                    key={exam.examId}
                    className={`kid-bar ${index === exams.length - 1 ? "latest" : ""}`}
                    title={`${exam.title}: ${exam.score}%`}
                  >
                    <b>{exam.score}%</b>
                    <span className="kid-bar-track">
                      <i style={{ height: `${Math.max(exam.score, 6)}%` }} />
                    </span>
                    <strong>{exam.title}</strong>
                    <small>
                      {index === exams.length - 1 ? "Latest · " : ""}
                      {exam.date}
                    </small>
                  </div>
                ))}
              </div>
            ) : (
              <p className="kid-progress-empty">
                When {info.name} checks your first {subject} test, it will show up here.
              </p>
            )}
          </section>

          <section className="card kid-practice-list compact">
            <h3>⭐ My {subject} practice</h3>
            {!practiceHere && (
              <p className="kid-progress-empty">
                No {subject} practice yet. {info.name} will add some when it helps you.
              </p>
            )}
            {practiceHere &&
              sets.map((set) => {
                const score = scoreOf(set);
                return (
                  <div className="kid-practice-row" key={set.id}>
                    <span className="kid-practice-row-name">
                      <strong>{set.title}</strong>
                      <small>
                        {score ? score.date : "New"}
                        {score && "checking" in score ? ` · ${info.name} is checking` : ""}
                      </small>
                    </span>
                    <span className="kid-practice-row-bottom">
                      {score ? (
                        <PracticeScore correct={score.correct} total={score.total} />
                      ) : (
                        <em className="kid-practice-new">Ready</em>
                      )}
                      <Button
                        variant={score ? "secondary" : "primary"}
                        onClick={() => onOpenPractice(set.id)}
                      >
                        {score ? "Practise again" : "Start"}
                      </Button>
                    </span>
                  </div>
                );
              })}
          </section>
        </div>
      </div>
    </PortalLayout>
  );
}

// ---------- Grade → Class → Student navigation (shared by all teacher work screens) ----------
type Scope = { grade: string; className: string };
const ALL = "all";
const classInfo = (className: string) => teacher.classes.find((item) => item.name === className);
const shortClass = (className: string) => classInfo(className)?.short ?? className;
const inScope = (scope: Scope, className: string) =>
  (scope.className === ALL || scope.className === className) &&
  (scope.grade === ALL || classInfo(className)?.grade === scope.grade);
const scopeLabel = (scope: Scope) =>
  scope.className !== ALL
    ? `class ${shortClass(scope.className)}`
    : scope.grade !== ALL
      ? scope.grade
      : "your classes";
const gradeNames = Array.from(new Set(teacher.classes.map((item) => item.grade)));

type NavItem = {
  id: string;
  name: string;
  initials: string;
  className: string;
  detail: string;
  state: string;
  /** open = needs the teacher now · wait = blocked by an earlier step · done = finished */
  tone: "open" | "wait" | "done";
};

/** Pick the selected item inside the current scope, falling back to the first open one. */
function pickInScope<T extends { id: string; className: string }>(
  items: T[],
  scope: Scope,
  selectedId: string,
  isOpen: (item: T) => boolean,
) {
  const visible = items.filter((item) => inScope(scope, item.className));
  return (
    visible.find((item) => item.id === selectedId) ?? visible.find(isOpen) ?? visible[0] ?? null
  );
}

function ClassNavigator({
  scope,
  onScope,
  items,
  selectedId,
  onSelect,
  noun,
  listMode = false,
}: {
  scope: Scope;
  onScope: (scope: Scope) => void;
  items: NavItem[];
  selectedId?: string;
  onSelect: (id: string) => void;
  /** e.g. "exams to verify" */
  noun: string;
  /** The screen shows every student in a list (Red Flags): the picker only jumps to one. */
  listMode?: boolean;
}) {
  // One row, always: [Class ▾] [Student ▾] [‹ 2 of 9 ›]  ……  "3 waiting for you".
  // It looks the same with 4 students or 40, because the list lives inside a searchable menu.
  const [menu, setMenu] = useState<"class" | "student" | null>(null);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!menu) return;
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setMenu(null);
    };
    const escape = (event: KeyboardEvent) => event.key === "Escape" && setMenu(null);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [menu]);
  const toggle = (which: "class" | "student") => {
    setQuery("");
    setMenu((current) => (current === which ? null : which));
  };

  const waiting = (match: (item: NavItem) => boolean) =>
    items.filter((item) => item.tone === "open" && match(item)).length;
  const visible = items.filter((item) => inScope(scope, item.className));
  // People who need the teacher come first, then class order.
  const toneRank = { open: 0, wait: 1, done: 2 } as const;
  const ordered = [...visible].sort((x, y) => toneRank[x.tone] - toneRank[y.tone]);
  const selectedIndex = ordered.findIndex((item) => item.id === selectedId);
  const selectedItem = selectedIndex >= 0 ? ordered[selectedIndex] : undefined;
  const openCount = ordered.filter((item) => item.tone === "open").length;
  const step = (delta: number) => {
    if (!ordered.length) return;
    const next = ordered[(Math.max(selectedIndex, 0) + delta + ordered.length) % ordered.length];
    onSelect(next.id);
  };
  const matches = (item: NavItem) => item.name.toLowerCase().includes(query.trim().toLowerCase());
  const groups = teacher.classes
    .map((entry) => {
      const list = ordered.filter((item) => item.className === entry.name && matches(item));
      return {
        className: entry.name,
        items: list,
        open: list.filter((item) => item.tone === "open").length,
      };
    })
    .filter((group) => group.items.length > 0);
  const label =
    scope.className !== ALL
      ? `${scope.grade} · Class ${shortClass(scope.className)}`
      : scope.grade !== ALL
        ? `${scope.grade} · All classes`
        : "All classes";
  const choose = (next: Scope) => {
    onScope(next);
    setMenu(null);
  };
  const isActive = (grade: string, className: string) =>
    scope.grade === grade && scope.className === className;

  return (
    <section className="cn" aria-label="Choose class and student" ref={rootRef}>
      <div className="cn-picker">
        <button
          className={`cn-trigger ${menu === "class" ? "open" : ""}`}
          aria-haspopup="menu"
          aria-expanded={menu === "class"}
          onClick={() => toggle("class")}
        >
          <Icon name="school" size={18} />
          <span className="cn-trigger-text">
            <small>Class</small>
            <strong>{label}</strong>
          </span>
          <Icon name="chevron" size={16} />
        </button>
        {menu === "class" && (
          <div className="cn-menu" role="menu">
            <button
              role="menuitem"
              className={`cn-option all ${isActive(ALL, ALL) ? "active" : ""}`}
              onClick={() => choose({ grade: ALL, className: ALL })}
            >
              <span>All classes</span>
              <em>{waiting(() => true) || "–"}</em>
            </button>
            {gradeNames.map((grade) => (
              <div className="cn-group" key={grade}>
                <button
                  role="menuitem"
                  className={`cn-option grade ${isActive(grade, ALL) ? "active" : ""}`}
                  onClick={() => choose({ grade, className: ALL })}
                >
                  <span>{grade}</span>
                  <em>{waiting((item) => classInfo(item.className)?.grade === grade) || "–"}</em>
                </button>
                {teacher.classes
                  .filter((item) => item.grade === grade)
                  .map((item) => {
                    const count = waiting((entry) => entry.className === item.name);
                    return (
                      <button
                        role="menuitem"
                        key={item.name}
                        className={`cn-option class ${isActive(grade, item.name) ? "active" : ""}`}
                        onClick={() => choose({ grade, className: item.name })}
                      >
                        <span>Class {item.short}</span>
                        <em className={count ? "has" : ""}>
                          {count ? `${count} waiting` : "Nothing waiting"}
                        </em>
                      </button>
                    );
                  })}
              </div>
            ))}
          </div>
        )}
      </div>

      {visible.length ? (
        <>
          <div className="cn-picker cn-student-picker">
            <button
              className={`cn-trigger cn-student ${menu === "student" ? "open" : ""}`}
              aria-haspopup="listbox"
              aria-expanded={menu === "student"}
              onClick={() => toggle("student")}
            >
              <span className={`cn-avatar ${selectedItem ? "" : "empty"}`} aria-hidden="true">
                {selectedItem?.initials ?? <Icon name="search" size={14} />}
              </span>
              <span className="cn-trigger-text">
                <small>{listMode ? "Jump to student" : "Student"}</small>
                <strong>
                  {selectedItem?.name ??
                    (listMode ? `All ${ordered.length} students` : "Choose a student")}
                </strong>
              </span>
              {selectedItem && (
                <span className={`cn-state ${selectedItem.tone}`}>{selectedItem.state}</span>
              )}
              <Icon name="chevron" size={16} />
            </button>
            {menu === "student" && (
              <div className="cn-menu cn-student-menu" role="listbox" aria-label="Students">
                {ordered.length > 6 && (
                  <input
                    autoFocus
                    className="cn-search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search a student…"
                  />
                )}
                <div className="cn-list">
                  {groups.length === 0 && <p className="cn-empty">No student found.</p>}
                  {groups.map((group) => (
                    <div key={group.className} className="cn-list-group">
                      {scope.className === ALL && (
                        <div className="cn-list-head">
                          Class {shortClass(group.className)}
                          {group.open > 0 && <em>{group.open} waiting</em>}
                        </div>
                      )}
                      {group.items.map((item) => (
                        <button
                          key={item.id}
                          role="option"
                          aria-selected={item.id === selectedId}
                          title={item.detail}
                          className={`cn-row ${item.tone} ${item.id === selectedId ? "active" : ""}`}
                          onClick={() => {
                            onSelect(item.id);
                            setMenu(null);
                          }}
                        >
                          <span className="cn-dot" aria-hidden="true" />
                          <span className="cn-row-name">{item.name}</span>
                          <span className={`cn-state ${item.tone}`}>{item.state}</span>
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {(!listMode || selectedItem) && (
            <div className="cn-stepper" role="group" aria-label="Previous or next student">
              <button
                aria-label="Previous student"
                disabled={ordered.length < 2}
                onClick={() => step(-1)}
              >
                <Icon name="chevron" size={15} />
              </button>
              <span>
                {selectedIndex >= 0 ? selectedIndex + 1 : "–"} of {ordered.length}
              </span>
              <button
                aria-label="Next student"
                disabled={ordered.length < 2}
                onClick={() => step(1)}
              >
                <Icon name="chevron" size={15} />
              </button>
            </div>
          )}

          <span className={`cn-summary ${openCount ? "has" : ""}`}>
            {openCount ? (
              <>
                <b>{openCount}</b> waiting for you
              </>
            ) : (
              <>
                <Icon name="check" size={13} /> Nothing waiting
              </>
            )}
          </span>
        </>
      ) : (
        <p className="cn-empty">
          No {noun} in {scopeLabel(scope)}.
        </p>
      )}
    </section>
  );
}

/** Shown instead of a workspace when nothing on this screen is in the chosen class. */
function ScopeEmpty({
  scope,
  onScope,
  items,
  noun,
}: {
  scope: Scope;
  onScope: (scope: Scope) => void;
  items: NavItem[];
  noun: string;
}) {
  const elsewhere = teacher.classes
    .map((item) => ({
      ...item,
      open: items.filter((entry) => entry.className === item.name && entry.tone === "open").length,
    }))
    .filter((item) => item.open > 0);
  return (
    <section className="card ocr-reading-state">
      <span className="ocr-reading-icon">
        <Icon name="check" size={28} />
      </span>
      <div className="section-title">Nothing waiting in {scopeLabel(scope)}</div>
      <p>There are no {noun} here right now.</p>
      {elsewhere.length > 0 && (
        <div className="scope-empty-links">
          <span>Work waiting in:</span>
          {elsewhere.map((item) => (
            <button
              key={item.name}
              onClick={() => onScope({ grade: item.grade, className: item.name })}
            >
              {item.short} <b>{item.open}</b>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

/** Expected answers for the checked papers (used for the AI's suggested scores). */
const ocrAnswerKey: Record<string, { expected: string; accepted: string[] }> = {
  "yehia-q1": { expected: "24", accepted: [] },
  "yehia-q2": { expected: "56", accepted: [] },
  "yehia-q3": { expected: "27 chairs", accepted: ["27"] },
  "nour-q1": { expected: "1/2 ist größer", accepted: ["1/2"] },
  "nour-q2": { expected: "1/2", accepted: ["2/4 = 1/2", "2/4=1/2"] },
  "nour-q3": { expected: "1/6, 1/3, 1/2", accepted: ["1/6 1/3 1/2"] },
  "adam-q1": {
    expected: "Any fraction equal to 1/2 (2/4, 3/6, 4/8)",
    accepted: ["2/4", "3/6", "4/8", "5/10"],
  },
  "adam-q2": {
    expected: "Yes, because 3 is half of 6",
    accepted: ["yes because 3 is half of 6", "yes"],
  },
  "adam-q3": { expected: "4", accepted: [] },
};

function TeacherOCRVerification({
  tasks,
  selectedId,
  onSelect,
  onUpdateAnswers,
  onComplete,
  onRequestReupload,
  onReopen,
  scope,
  onScope,
  onNavigate,
  onLogout,
}: {
  tasks: OCRTask[];
  scope: Scope;
  onScope: (scope: Scope) => void;
  selectedId: string;
  onSelect: (id: string) => void;
  onUpdateAnswers: (taskId: string, update: (answers: OCRAnswer[]) => OCRAnswer[]) => void;
  onComplete: (taskId: string) => void;
  /** Stop grading this exam and ask the student to upload it again. */
  onRequestReupload: (taskId: string, message: string) => void;
  onReopen: (taskId: string) => void;
  onNavigate: (label: string) => void;
  onLogout: () => void;
}) {
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(100);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [onlyAttention, setOnlyAttention] = useState(false);
  /** Draft of the "please upload again" message, or null when the panel is closed. */
  const [reupload, setReupload] = useState<string | null>(null);
  const cardRefs = useRef<Record<string, HTMLElement | null>>({});
  const task = pickInScope(
    tasks,
    scope,
    selectedId,
    (item) => item.readiness === "ready" && !item.completed,
  );
  useEffect(() => {
    setPage(1);
    setFocusedId(null);
    setEditingId(null);
    setOnlyAttention(false);
  }, [task?.id]);

  const navItems: NavItem[] = tasks.map((item) => {
    const open = item.answers.filter((answer) => answer.status === "pending");
    const flagged = open.filter((answer) => answer.confidence < 70).length;
    return {
      id: item.id,
      name: item.studentName,
      initials: item.initials,
      className: item.className,
      detail: `${item.title} · ${item.language === "German" ? "DE" : "EN"}`,
      state:
        item.readiness === "reading"
          ? "AI still reading"
          : item.completed
            ? "Verified"
            : flagged
              ? `${flagged} need attention`
              : `${open.length} to check`,
      tone: item.readiness === "reading" ? "wait" : item.completed ? "done" : "open",
    };
  });
  const navigator = <GradingQueue examId={task?.id} />;
  const stepBar = <ReviewSteps examId={task?.id} current="reading" />;
  if (!task)
    return (
      <PortalLayout
        role="teacher"
        active="OCR Verification"
        onNavigate={onNavigate}
        onLogout={onLogout}
      >
        <Topbar
          title="Grading"
          subtitle="Check what the AI read from each paper before anything is graded."
        />
        <div className="content teacher-workflow-content gw ocr-v2">
          {navigator}
          <ScopeEmpty scope={scope} onScope={onScope} items={navItems} noun="exams to verify" />
        </div>
      </PortalLayout>
    );

  const isGerman = task.language === "German";
  const firstName = task.studentName.split(" ")[0];
  const locked = task.completed || task.readiness === "reading";
  const lowConfidence = (answer: OCRAnswer) => answer.confidence < 70;
  const needsAttention = (answer: OCRAnswer) =>
    (answer.status === "pending" && lowConfidence(answer)) || answer.status === "unreadable";

  const pending = task.answers.filter((answer) => answer.status === "pending").length;
  const verified = task.answers.filter((answer) => answer.status === "verified").length;
  const corrected = task.answers.filter((answer) => answer.status === "corrected").length;
  const unreadable = task.answers.filter((answer) => answer.status === "unreadable").length;
  const lowCount = task.answers.filter(lowConfidence).length;
  const checked = task.answers.length - pending;
  const progress = task.answers.length ? Math.round((checked / task.answers.length) * 100) : 0;

  const pageAnswers = task.answers
    .filter((answer) => answer.page === page)
    .sort((a, b) => Number(needsAttention(b)) - Number(needsAttention(a)));
  const visibleAnswers = onlyAttention ? pageAnswers.filter(needsAttention) : pageAnswers;

  const switchTask = (id: string) => {
    onSelect(id);
    setPage(1);
    setFocusedId(null);
    setEditingId(null);
    setOnlyAttention(false);
  };

  const goToPage = (next: number) => {
    setPage(next);
    setFocusedId(null);
    setEditingId(null);
  };

  const update = (id: string, changes: Partial<OCRAnswer>) =>
    onUpdateAnswers(task.id, (answers) =>
      answers.map((answer) => (answer.id === id ? { ...answer, ...changes } : answer)),
    );

  const focusAnswer = (id: string) => {
    setFocusedId(id);
    cardRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  const nextReadyTask =
    tasks.find(
      (item) =>
        item.id !== task.id &&
        item.readiness === "ready" &&
        !item.completed &&
        inScope(scope, item.className),
    ) ?? tasks.find((item) => item.id !== task.id && item.readiness === "ready" && !item.completed);

  const goToNextUnchecked = () => {
    const ordered = [...task.answers].sort(
      (a, b) => a.page - b.page || Number(needsAttention(b)) - Number(needsAttention(a)),
    );
    const next =
      ordered.find((answer) => answer.status === "pending" && answer.page >= page) ??
      ordered.find((answer) => answer.status === "pending");
    if (!next) return;
    setOnlyAttention(false);
    setEditingId(null);
    setPage(next.page);
    setFocusedId(next.id);
    window.setTimeout(
      () => cardRefs.current[next.id]?.scrollIntoView({ behavior: "smooth", block: "center" }),
      60,
    );
  };

  const startEdit = (answer: OCRAnswer) => {
    setEditingId(answer.id);
    setDraft(answer.extractedText);
    setFocusedId(answer.id);
  };

  const saveEdit = (answer: OCRAnswer) => {
    const text = draft.trim();
    if (!text) return;
    update(answer.id, {
      extractedText: text,
      status: text === answer.aiReading ? "verified" : "corrected",
      rescanRequested: false,
    });
    setEditingId(null);
  };

  const undo = (answer: OCRAnswer) =>
    update(answer.id, {
      status: "pending",
      extractedText: answer.aiReading,
      rescanRequested: false,
    });

  const pageStatus = (pageNumber: number) => {
    const answers = task.answers.filter((answer) => answer.page === pageNumber);
    if (answers.some((answer) => answer.status === "unreadable"))
      return { type: "danger" as const, label: "Unreadable" };
    const open = answers.filter((answer) => answer.status === "pending");
    if (open.length === 0) return { type: "success" as const, label: "Checked" };
    if (open.some(lowConfidence)) return { type: "warning" as const, label: "Check closely" };
    return { type: "neutral" as const, label: `${open.length} to check` };
  };

  const statusBadge = (answer: OCRAnswer) => {
    if (answer.status === "verified")
      return (
        <Badge type="success">
          <Icon name="check" size={11} /> Confirmed
        </Badge>
      );
    if (answer.status === "corrected")
      return (
        <Badge type="blue">
          <Icon name="practice" size={11} /> Corrected by you
        </Badge>
      );
    if (answer.status === "unreadable") return <Badge type="danger">Unreadable</Badge>;
    return (
      <Badge type={lowConfidence(answer) ? "warning" : "neutral"}>
        {lowConfidence(answer)
          ? "Check carefully"
          : answer.confidence < 90
            ? "Probably right"
            : "AI is sure"}
      </Badge>
    );
  };

  return (
    <PortalLayout
      role="teacher"
      active="OCR Verification"
      onNavigate={onNavigate}
      onLogout={onLogout}
    >
      <Topbar
        title="Grading"
        subtitle="Check what the AI read from each paper before anything is graded."
      />
      <div className="content teacher-workflow-content gw ocr-v2">
        {navigator}
        {stepBar}

        <div className="sw">
          <section className="workflow-exam-bar">
            <div className="workflow-student">
              <span className="avatar avatar-navy">{task.initials}</span>
              <div>
                <ProfileLink studentId={task.studentId} name={task.studentName} />
                <span>
                  {task.className} · {task.title}
                </span>
              </div>
            </div>
            <div className="workflow-exam-meta">
              <Badge type="blue">{task.subject}</Badge>
              <span className={`language-chip ${isGerman ? "de" : "en"}`}>
                {isGerman ? "DE · German" : "EN · English"}
              </span>
              <span>{task.pages} pages</span>
              <span>Submitted {task.submittedAt}</span>
            </div>
            <div className="ocr-progress">
              <div>
                <strong>
                  {checked}/{task.answers.length}
                </strong>
                <span>answers checked</span>
              </div>
              <div className="ocr-progress-bar" aria-hidden="true">
                <i style={{ width: `${progress}%` }} />
              </div>
            </div>
          </section>

          {task.readiness === "reading" ? (
            <section className="card ocr-reading-state">
              <span className="ocr-reading-icon">
                <Icon name="scan" size={28} />
              </span>
              <div className="section-title">The AI is still reading this exam</div>
              <p>
                {task.studentName}'s paper was uploaded on {task.submittedAt}. You can verify it as
                soon as the text has been extracted. Nothing is graded before you check it.
              </p>
              {tasks.some((item) => item.readiness === "ready" && !item.completed) && (
                <Button
                  variant="secondary"
                  onClick={() =>
                    switchTask(
                      tasks.find((item) => item.readiness === "ready" && !item.completed)!.id,
                    )
                  }
                >
                  Open the next ready exam <Icon name="arrow" />
                </Button>
              )}
            </section>
          ) : (
            <>
              {task.completed ? (
                <div className="ocr-banner done">
                  <Icon name="check" size={18} />
                  <div>
                    <strong>Verification complete</strong>
                    <span>
                      Your checked text was sent to AI grading.{" "}
                      {unreadable > 0 &&
                        `${unreadable} unreadable answer${unreadable > 1 ? "s" : ""} will be graded from the paper.`}
                    </span>
                  </div>
                  <Button variant="secondary" onClick={() => onReopen(task.id)}>
                    Reopen verification
                  </Button>
                  {task.id === tasks[0].id && (
                    <Button onClick={() => onNavigate("Grade Review")}>
                      Go to Grade Review <Icon name="arrow" />
                    </Button>
                  )}
                </div>
              ) : (
                <div className="ocr-banner ai">
                  <Icon name="spark" size={18} />
                  <div>
                    <strong>
                      AI suggestion: the system read {task.answers.length} answers
                      {isGerman ? " in German" : ""}.
                    </strong>
                    <span>
                      {lowCount > 0
                        ? `${lowCount} answer${lowCount > 1 ? "s have" : " has"} low confidence and ${lowCount > 1 ? "are" : "is"} shown first. Compare each answer with the paper before confirming.`
                        : "Compare each answer with the paper before confirming."}
                    </span>
                  </div>
                </div>
              )}

              <div className="ocr-workspace">
                <section className="card original-exam-panel">
                  <div className="ocr-panel-toolbar">
                    <div>
                      <strong>Original paper</strong>
                      <span>Click an answer on the paper to find it</span>
                    </div>
                    <div className="zoom-controls">
                      <button
                        aria-label="Zoom out"
                        onClick={() => setZoom((value) => Math.max(80, value - 10))}
                      >
                        <Icon name="zoom-out" size={16} />
                      </button>
                      <span>{zoom}%</span>
                      <button
                        aria-label="Zoom in"
                        onClick={() => setZoom((value) => Math.min(160, value + 10))}
                      >
                        <Icon name="zoom-in" size={16} />
                      </button>
                    </div>
                  </div>
                  <div className="ocr-page-tabs" role="tablist" aria-label="Exam pages">
                    {Array.from({ length: task.pages }, (_, index) => index + 1).map(
                      (pageNumber) => {
                        const state = pageStatus(pageNumber);
                        return (
                          <button
                            key={pageNumber}
                            role="tab"
                            aria-selected={page === pageNumber}
                            className={`ocr-page-tab ${page === pageNumber ? "active" : ""}`}
                            onClick={() => goToPage(pageNumber)}
                          >
                            <span className="ocr-page-tab-name">Page {pageNumber}</span>
                            <Badge type={state.type}>{state.label}</Badge>
                          </button>
                        );
                      },
                    )}
                  </div>
                  <div className="teacher-paper-stage">
                    <div className="handwritten-paper" style={{ zoom: zoom / 100 }}>
                      <div className="paper-heading">{task.title}</div>
                      <div className="handwritten-name">
                        {task.studentName} &nbsp;&nbsp; {task.className}
                      </div>
                      {task.answers
                        .filter((answer) => answer.page === page)
                        .map((answer, index) => (
                          <button
                            type="button"
                            className={`paper-answer ${focusedId === answer.id ? "focused" : ""} ${
                              answer.status === "pending" && lowConfidence(answer) ? "low" : ""
                            } ${answer.status === "unreadable" ? "unreadable" : ""}`}
                            key={answer.id}
                            onClick={() => focusAnswer(answer.id)}
                          >
                            <strong>{answer.question}</strong>
                            <span
                              className={`paper-handwriting ${index % 2 ? "alt" : ""} ${answer.messy ? "messy" : ""}`}
                            >
                              {answer.handwritten}
                            </span>
                            {answer.status === "pending" && lowConfidence(answer) && (
                              <em>Hard to read</em>
                            )}
                          </button>
                        ))}
                    </div>
                  </div>
                  <div className="page-navigation">
                    <Button
                      variant="secondary"
                      disabled={page === 1}
                      onClick={() => goToPage(page - 1)}
                    >
                      <Icon name="arrow" /> Previous page
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={page === task.pages}
                      onClick={() => goToPage(page + 1)}
                    >
                      Next page <Icon name="arrow" />
                    </Button>
                  </div>
                </section>

                <aside className="card extracted-text-panel">
                  <div className="extracted-panel-header">
                    <div>
                      <div className="workflow-panel-title">Extracted text</div>
                      <p>This text is what the AI will grade.</p>
                    </div>
                    <Badge type="ai">
                      <Icon name="spark" size={12} /> AI extracted
                    </Badge>
                  </div>
                  {!locked &&
                    (reupload === null ? (
                      <button
                        className="ocr-reupload-link"
                        onClick={() =>
                          setReupload(
                            `Hi ${task.studentName.split(" ")[0]}, I could not read your ${task.title} clearly. Please take new, clear photos of every page and upload the exam again. Thank you! – Ms. Nadia`,
                          )
                        }
                      >
                        <Icon name="camera" size={14} /> Hard to read? Ask{" "}
                        {task.studentName.split(" ")[0]} to re-upload
                      </button>
                    ) : (
                      <div className="ocr-reupload">
                        <strong>
                          Cancel grading and ask {task.studentName.split(" ")[0]} to upload again
                        </strong>
                        <span>
                          This exam leaves your grading list. {task.studentName.split(" ")[0]} gets
                          this message:
                        </span>
                        <textarea
                          autoFocus
                          value={reupload}
                          onChange={(event) => setReupload(event.target.value)}
                        />
                        <div className="ocr-reupload-actions">
                          <Button variant="ghost" onClick={() => setReupload(null)}>
                            Keep grading
                          </Button>
                          <Button
                            className="ocr-reupload-send"
                            disabled={!reupload.trim()}
                            onClick={() => {
                              onRequestReupload(task.id, reupload.trim());
                              setReupload(null);
                            }}
                          >
                            Cancel grading &amp; send <Icon name="arrow" size={14} />
                          </Button>
                        </div>
                      </div>
                    ))}
                  <div className="ocr-filter" role="group" aria-label="Filter answers">
                    <button
                      className={!onlyAttention ? "active" : ""}
                      onClick={() => setOnlyAttention(false)}
                    >
                      All on this page ({pageAnswers.length})
                    </button>
                    <button
                      className={onlyAttention ? "active" : ""}
                      onClick={() => setOnlyAttention(true)}
                    >
                      Needs attention ({pageAnswers.filter(needsAttention).length})
                    </button>
                  </div>
                  <div className="ocr-answer-list">
                    {visibleAnswers.length === 0 && (
                      <div className="ocr-empty">Nothing needs attention on this page.</div>
                    )}
                    {visibleAnswers.map((answer) => (
                      <article
                        ref={(element) => {
                          cardRefs.current[answer.id] = element;
                        }}
                        className={`ocr-answer-card ${answer.status} ${
                          answer.status === "pending" && lowConfidence(answer) ? "uncertain" : ""
                        } ${focusedId === answer.id ? "focused" : ""}`}
                        key={answer.id}
                        onClick={() => setFocusedId(answer.id)}
                      >
                        <div className="ocr-answer-heading">
                          <strong>Q{answer.question.split(".")[0]}</strong>
                          {statusBadge(answer)}
                        </div>
                        <p className="ocr-question">{answer.question}</p>

                        {editingId === answer.id ? (
                          <>
                            <textarea
                              className="ocr-edit-field"
                              value={draft}
                              autoFocus
                              onChange={(event) => setDraft(event.target.value)}
                            />
                            <span className="ocr-hint">
                              Type exactly what {firstName} wrote, including mistakes. Do not fix
                              the answer itself.
                            </span>
                            <div className="ocr-answer-actions">
                              <button className="primary" onClick={() => saveEdit(answer)}>
                                <Icon name="check" size={13} /> Save correction
                              </button>
                              <button onClick={() => setEditingId(null)}>Cancel</button>
                            </div>
                          </>
                        ) : (
                          <>
                            <div
                              className={`extracted-answer ${answer.status === "unreadable" ? "struck" : ""}`}
                            >
                              {answer.extractedText}
                            </div>
                            {answer.status === "corrected" && (
                              <span className="ocr-hint">
                                AI read: <s>{answer.aiReading}</s>
                              </span>
                            )}
                            {answer.status === "unreadable" && (
                              <div className="unreadable-box">
                                <span>
                                  This answer will not be graded by AI. You will grade it from the
                                  paper.
                                </span>
                                <button
                                  disabled={locked}
                                  className={answer.rescanRequested ? "requested" : ""}
                                  onClick={() =>
                                    update(answer.id, { rescanRequested: !answer.rescanRequested })
                                  }
                                >
                                  <Icon
                                    name={answer.rescanRequested ? "check" : "scan"}
                                    size={13}
                                  />
                                  {answer.rescanRequested
                                    ? `Rescan requested from ${firstName}`
                                    : `Ask ${firstName} to rescan page ${answer.page}`}
                                </button>
                              </div>
                            )}
                            {!locked && (
                              <div className="ocr-answer-actions">
                                {answer.status === "pending" ? (
                                  <>
                                    <button
                                      className="primary"
                                      onClick={() => update(answer.id, { status: "verified" })}
                                    >
                                      <Icon name="check" size={13} /> Correct as read
                                    </button>
                                    <button onClick={() => startEdit(answer)}>
                                      <Icon name="practice" size={13} /> Fix text
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    {answer.status !== "unreadable" && (
                                      <button onClick={() => startEdit(answer)}>
                                        <Icon name="practice" size={13} /> Edit again
                                      </button>
                                    )}
                                    <button onClick={() => undo(answer)}>Undo</button>
                                  </>
                                )}
                              </div>
                            )}
                          </>
                        )}
                      </article>
                    ))}
                  </div>
                </aside>
              </div>

              <div
                className={`ocr-action-bar ${task.completed ? "done" : pending === 0 ? "ready" : ""}`}
              >
                <div className="ocr-action-status">
                  <strong>
                    {task.completed
                      ? "Verification complete"
                      : pending === 0
                        ? "All answers checked – ready for grading"
                        : `${checked} of ${task.answers.length} answers checked`}
                  </strong>
                  <div className="ocr-progress-bar" aria-hidden="true">
                    <i style={{ width: `${progress}%` }} />
                  </div>
                  <div className="ocr-tally">
                    <span className="tally success">
                      <Icon name="check" size={12} /> {verified} confirmed
                    </span>
                    <span className="tally blue">
                      <Icon name="practice" size={12} /> {corrected} corrected
                    </span>
                    {pending > 0 && <span className="tally neutral">{pending} still to check</span>}
                  </div>
                </div>
                <Button variant="secondary" onClick={() => onNavigate("Grading")}>
                  Back to Grading
                </Button>
                {task.completed ? (
                  task.id === tasks[0].id ? (
                    <Button onClick={() => onNavigate("Grade Review")}>
                      Go to Grade Review <Icon name="arrow" />
                    </Button>
                  ) : nextReadyTask ? (
                    <Button onClick={() => switchTask(nextReadyTask.id)}>
                      Next exam: {nextReadyTask.studentName} <Icon name="arrow" />
                    </Button>
                  ) : null
                ) : pending > 0 ? (
                  <Button onClick={goToNextUnchecked}>
                    Next unchecked answer <Icon name="arrow" />
                  </Button>
                ) : (
                  <Button className="pulse" onClick={() => onComplete(task.id)}>
                    Send to AI grading <Icon name="arrow" />
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </PortalLayout>
  );
}

const formatMarks = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(1));

function TeacherGradeReview({
  tasks,
  selectedId,
  onSelect,
  ocrAnswers,
  onUpdateQuestions,
  onFinalize,
  onReopen,
  scope,
  onScope,
  onNavigate,
  onLogout,
}: {
  tasks: GradeTask[];
  scope: Scope;
  onScope: (scope: Scope) => void;
  selectedId: string;
  onSelect: (id: string) => void;
  /** OCR answers of the main workflow exam, used to show corrections and paper handwriting. */
  ocrAnswers: OCRAnswer[];
  onUpdateQuestions: (
    taskId: string,
    update: (questions: GradeQuestion[]) => GradeQuestion[],
  ) => void;
  onFinalize: (taskId: string, finalScore: number) => void;
  onReopen: (taskId: string) => void;
  onNavigate: (label: string) => void;
  onLogout: () => void;
}) {
  const [overrideId, setOverrideId] = useState<string | null>(null);
  const [draftScore, setDraftScore] = useState(0);
  const [draftReason, setDraftReason] = useState("");
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const cardRefs = useRef<Record<string, HTMLElement | null>>({});
  const [qIndex, setQIndex] = useState(0);
  const [mode, setMode] = useState<"edit" | "override" | null>(null);
  const task = pickInScope(tasks, scope, selectedId, (item) => item.ocrDone && !item.finalized);
  useEffect(() => {
    setOverrideId(null);
    setFocusedId(null);
    setMode(null);
    // Open on the first question that still needs a decision.
    const firstOpen = task?.questions.findIndex((question) => !question.decision) ?? 0;
    setQIndex(firstOpen < 0 ? 0 : firstOpen);
  }, [task?.id]);

  const navItems: NavItem[] = tasks.map((item) => {
    const open = item.questions.filter((question) => !question.decision).length;
    return {
      id: item.id,
      name: item.studentName,
      initials: item.initials,
      className: item.className,
      detail: `${item.title} · ${item.subject}`,
      state: !item.ocrDone
        ? "Verify text first"
        : item.finalized
          ? `Final ${item.finalScore}%`
          : `${open} to decide`,
      tone: !item.ocrDone ? "wait" : item.finalized ? "done" : "open",
    };
  });
  const navigator = <GradingQueue examId={task?.id} />;
  const stepBar = <ReviewSteps examId={task?.id} current="grades" />;
  if (!task)
    return (
      <PortalLayout
        role="teacher"
        active="Grade Review"
        onNavigate={onNavigate}
        onLogout={onLogout}
      >
        <Topbar
          title="Grading"
          subtitle="The AI suggests a score for each answer. You decide the final grade."
        />
        <div className="content teacher-workflow-content gw grade-v2">
          {navigator}
          <ScopeEmpty scope={scope} onScope={onScope} items={navItems} noun="exams to grade" />
        </div>
      </PortalLayout>
    );

  const firstName = task.studentName.split(" ")[0];
  const isGerman = task.language === "German";
  const questions = task.questions;
  const decided = questions.filter((question) => question.decision).length;
  const undecided = questions.length - decided;
  const maximum = questions.reduce((sum, question) => sum + question.maxScore, 0);
  const confirmedMarks = questions.reduce(
    (sum, question) => sum + (question.decision ? (question.finalScore ?? 0) : 0),
    0,
  );
  const confirmedMax = questions.reduce(
    (sum, question) => sum + (question.decision ? question.maxScore : 0),
    0,
  );
  const aiEstimate = Math.round(
    (questions.reduce(
      (sum, question) => sum + (question.ocrUnreadable ? 0 : question.suggestedScore),
      0,
    ) /
      maximum) *
      100,
  );
  const finalPercentage = Math.round((confirmedMarks / maximum) * 100);
  const allDecided = undecided === 0;
  const progress = questions.length ? Math.round((decided / questions.length) * 100) : 0;
  const correctedCount = questions.filter(
    (question) => ocrAnswers.find((answer) => answer.id === question.ocrId)?.status === "corrected",
  ).length;
  const nextReadyTask =
    tasks.find(
      (item) =>
        item.id !== task.id && item.ocrDone && !item.finalized && inScope(scope, item.className),
    ) ?? tasks.find((item) => item.id !== task.id && item.ocrDone && !item.finalized);
  const locked = task.finalized;

  const switchTask = (id: string) => {
    onSelect(id);
    setOverrideId(null);
    setFocusedId(null);
  };

  const update = (id: string, changes: Partial<GradeQuestion>) =>
    onUpdateQuestions(task.id, (current) =>
      current.map((question) => (question.id === id ? { ...question, ...changes } : question)),
    );

  const accept = (question: GradeQuestion) => {
    if (question.id === current?.id) {
      decide({
        decision: "accepted",
        finalScore: question.suggestedScore,
        teacherNote: question.suggestedScore < question.maxScore ? question.teacherNote : undefined,
      });
      return;
    }
    update(question.id, {
      decision: "accepted",
      finalScore: question.suggestedScore,
      teacherNote: undefined,
    });
    if (overrideId === question.id) setOverrideId(null);
  };

  const openOverride = (question: GradeQuestion) => {
    setOverrideId(question.id);
    setFocusedId(question.id);
    setDraftScore(question.finalScore ?? (question.ocrUnreadable ? 0 : question.suggestedScore));
    setDraftReason(question.teacherNote ?? "");
  };

  const saveOverride = (question: GradeQuestion) => {
    const score = Math.min(question.maxScore, Math.max(0, draftScore));
    update(question.id, {
      decision:
        !question.ocrUnreadable && score === question.suggestedScore ? "accepted" : "overridden",
      finalScore: score,
      teacherNote: draftReason.trim() || undefined,
    });
    setOverrideId(null);
  };

  const undo = (question: GradeQuestion) =>
    update(question.id, { decision: undefined, finalScore: undefined, teacherNote: undefined });

  const goToNextUndecided = () => {
    const next = questions.find((question) => !question.decision);
    if (!next) return;
    setFocusedId(next.id);
    cardRefs.current[next.id]?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const reasonRequired = (question: GradeQuestion) =>
    question.ocrUnreadable || draftScore !== question.suggestedScore;

  // ---------- one question at a time ----------
  const current = questions[Math.min(qIndex, questions.length - 1)];
  const currentOcr = current ? ocrAnswers.find((answer) => answer.id === current.ocrId) : undefined;
  const goTo = (index: number) => {
    setMode(null);
    setQIndex(Math.max(0, Math.min(questions.length - 1, index)));
  };
  const nextOpenAfter = (index: number, list: GradeQuestion[]) => {
    const after = list.findIndex((question, position) => position > index && !question.decision);
    return after >= 0 ? after : list.findIndex((question) => !question.decision);
  };
  const decide = (changes: Partial<GradeQuestion>) => {
    const updated = questions.map((question, index) =>
      index === qIndex ? { ...question, ...changes } : question,
    );
    update(current.id, changes);
    setMode(null);
    const next = nextOpenAfter(qIndex, updated);
    if (next >= 0) setQIndex(next);
  };
  const openEdit = (which: "edit" | "override") => {
    setMode(which);
    setDraftScore(current.finalScore ?? (current.ocrUnreadable ? 0 : current.suggestedScore));
    setDraftReason(current.teacherNote ?? "");
  };
  // Edit: adjust the score (reason optional unless it differs). Override: a reason is always required.
  const needsReason = current
    ? mode === "override" || current.ocrUnreadable || draftScore !== current.suggestedScore
    : false;
  const saveEdit = () => {
    const score = Math.min(current.maxScore, Math.max(0, draftScore));
    decide({
      decision: "edited",
      finalScore: score,
      teacherNote: score < current.maxScore ? current.teacherNote : undefined,
    });
  };

  return (
    <PortalLayout role="teacher" active="Grade Review" onNavigate={onNavigate} onLogout={onLogout}>
      <Topbar
        title="Grading"
        subtitle="The AI suggests a score for each answer. You decide the final grade."
      />
      <div className="content teacher-workflow-content gw grade-v2">
        {navigator}
        {stepBar}

        <div className="sw">
          <section className="workflow-exam-bar">
            <div className="workflow-student">
              <span className="avatar avatar-navy">{task.initials}</span>
              <div>
                <ProfileLink studentId={task.studentId} name={task.studentName} />
                <span>
                  {task.className} · {task.title}
                </span>
              </div>
            </div>
            <div className="workflow-exam-meta">
              <Badge type="blue">{task.subject}</Badge>
              <span className={`language-chip ${isGerman ? "de" : "en"}`}>
                {isGerman ? "DE · German" : "EN · English"}
              </span>
              <span>{questions.length} questions</span>
              <span>{maximum} marks</span>
            </div>
            <div className="ocr-progress">
              <div>
                <strong>
                  {decided}/{questions.length}
                </strong>
                <span>decisions made</span>
              </div>
              <div className="ocr-progress-bar" aria-hidden="true">
                <i style={{ width: `${progress}%` }} />
              </div>
            </div>
          </section>

          {!task.ocrDone ? (
            <section className="card ocr-reading-state">
              <span className="ocr-reading-icon">
                <Icon name="scan" size={28} />
              </span>
              <div className="section-title">Verify the extracted text first</div>
              <p>
                The AI only grades text you have checked. Finish OCR verification for{" "}
                {task.studentName}'s exam, then the suggested scores will appear here.
              </p>
              <Button onClick={() => onNavigate("OCR Verification")}>
                Go to OCR Verification <Icon name="arrow" />
              </Button>
            </section>
          ) : (
            <section className="card g2 g2-one">
              <div className="g2-nav">
                <button
                  aria-label="Previous question"
                  disabled={qIndex === 0}
                  onClick={() => goTo(qIndex - 1)}
                >
                  <Icon name="chevron" size={16} />
                </button>
                <strong>
                  Question {qIndex + 1} of {questions.length}
                </strong>
                <button
                  aria-label="Next question"
                  disabled={qIndex === questions.length - 1}
                  onClick={() => goTo(qIndex + 1)}
                >
                  <Icon name="chevron" size={16} />
                </button>
                <span className="g2-marks">
                  {current.maxScore} mark{current.maxScore === 1 ? "" : "s"}
                </span>
              </div>

              <div className="g2-body">
                <div className="g2-left">
                  <div className="g2-label">Question</div>
                  <p className="g2-text">{current.question}</p>
                  <div className="g2-answers">
                    <div>
                      <span>
                        {firstName}'s answer
                        {currentOcr?.status === "corrected" && (
                          <em className="corrected-tag">Corrected in OCR</em>
                        )}
                      </span>
                      <p>{current.studentAnswer}</p>
                      {currentOcr && (
                        <small className="g2-paper">
                          On the paper:{" "}
                          <b className="paper-handwriting">{currentOcr.handwritten}</b>
                        </small>
                      )}
                    </div>
                    <div>
                      <span>Expected answer</span>
                      <p>{current.expectedAnswer}</p>
                    </div>
                  </div>
                </div>

                <div className="g2-right">
                  {current.ocrUnreadable ? (
                    <div className="g2-ai manual">
                      <Icon name="flag" size={18} />
                      <div>
                        <strong>No AI score</strong>
                        <p>
                          You marked this answer unreadable in OCR. Read the paper and enter a score
                          yourself.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className={`g2-ai ${current.decision ? "decided" : ""}`}>
                      <Icon name="spark" size={18} />
                      <div>
                        <strong>
                          AI suggestion <i>· not final until you decide</i>
                        </strong>
                        <p>{current.rationale}</p>
                      </div>
                      <b className="g2-ai-score">
                        {formatMarks(current.suggestedScore)} / {current.maxScore}
                      </b>
                    </div>
                  )}
                  {current.decision && mode === null && (
                    <div className="g2-confirmed">
                      <Icon name="check" size={16} />
                      <div>
                        <strong>
                          Confirmed by teacher: {formatMarks(current.finalScore ?? 0)} /{" "}
                          {current.maxScore}
                        </strong>
                        <span>
                          {current.decision === "accepted"
                            ? "You accepted the AI score."
                            : current.decision === "edited"
                              ? "You edited the score."
                              : "You overrode the AI suggestion."}
                        </span>
                        {!locked && (
                          <span className="g2-change">
                            <button className="text-button" onClick={() => openEdit("edit")}>
                              Edit score
                            </button>
                            <button className="text-button" onClick={() => undo(current)}>
                              Clear
                            </button>
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                  {mode !== null && (
                    <div className="override-panel g2-edit">
                      <div className="override-row">
                        <span>{mode === "override" ? "Your score" : "Edited score"}</span>
                        <div className="score-picker" role="group" aria-label="Choose a score">
                          {Array.from(
                            { length: current.maxScore * 2 + 1 },
                            (_, step) => step / 2,
                          ).map((value) => (
                            <button
                              key={value}
                              className={`${draftScore === value ? "active" : ""} ${
                                !current.ocrUnreadable && value === current.suggestedScore
                                  ? "ai-mark"
                                  : ""
                              }`}
                              onClick={() => setDraftScore(value)}
                            >
                              {formatMarks(value)}
                            </button>
                          ))}
                        </div>
                        <small>of {current.maxScore}</small>
                      </div>

                      <div className="override-actions">
                        <Button onClick={saveEdit}>
                          <Icon name="check" size={15} /> Save score
                        </Button>
                        <Button variant="ghost" onClick={() => setMode(null)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                  {(mode !== null
                    ? draftScore
                    : (current.finalScore ??
                      (current.ocrUnreadable ? 0 : current.suggestedScore))) < current.maxScore && (
                    <label className="g2-why">
                      <span>
                        Why is it not full marks? <i>(optional · {firstName} sees this)</i>
                      </span>
                      <textarea
                        value={current.teacherNote ?? ""}
                        disabled={locked}
                        placeholder={
                          current.ocrUnreadable
                            ? "e.g. Show your working so I can follow it."
                            : `e.g. ${current.rationale}`
                        }
                        onChange={(event) =>
                          update(current.id, { teacherNote: event.target.value || undefined })
                        }
                      />
                    </label>
                  )}
                  {!locked && mode === null && !current.decision && (
                    <div className="g2-decision">
                      <div className="g2-buttons">
                        {!current.ocrUnreadable && (
                          <button
                            className={current.decision === "accepted" ? "chosen" : ""}
                            onClick={() => accept(current)}
                          >
                            <Icon name="check" size={16} /> Accept AI score (
                            {formatMarks(current.suggestedScore)}/{current.maxScore})
                          </button>
                        )}
                        <button
                          className={
                            current.decision === "edited" || current.decision === "overridden"
                              ? "chosen"
                              : ""
                          }
                          onClick={() => openEdit("edit")}
                        >
                          <Icon name="practice" size={16} />{" "}
                          {current.ocrUnreadable ? "Enter score from paper" : "Edit score"}
                        </button>
                      </div>
                      {current.decision && (
                        <button className="text-button g2-undo" onClick={() => undo(current)}>
                          Clear my decision
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <footer className={`g2-foot ${task.finalized ? "final" : ""}`}>
                <div
                  className="g2-ring small"
                  style={{ "--pct": `${(confirmedMarks / maximum) * 100}%` } as React.CSSProperties}
                >
                  <div>
                    <strong>{finalPercentage}%</strong>
                  </div>
                </div>
                <div className="g2-foot-text">
                  <strong>
                    {task.finalized
                      ? `Grade finalized: ${task.finalScore}%`
                      : `${formatMarks(confirmedMarks)} / ${maximum} marks confirmed`}
                  </strong>
                  <span>
                    {decided} of {questions.length} questions decided
                    {!allDecided && !task.finalized
                      ? ` · AI estimate ${aiEstimate}% · decide every question to finalize`
                      : ""}
                  </span>
                </div>
                {task.finalized ? (
                  <div className="g2-final">
                    <Button variant="ghost" onClick={() => onReopen(task.id)}>
                      Reopen grading
                    </Button>
                    <ContinueStep examId={task.id} from="grades" name={firstName} />
                  </div>
                ) : (
                  <Button
                    className="g2-finalize"
                    disabled={!allDecided}
                    onClick={() => onFinalize(task.id, finalPercentage)}
                  >
                    Finalize Grade &amp; Continue <Icon name="arrow" />
                  </Button>
                )}
              </footer>
            </section>
          )}
        </div>
      </div>
    </PortalLayout>
  );
}

const dismissReasons = [
  "Careless slip, not a concept gap",
  "Not enough evidence yet",
  "Already addressed in class",
  "Reading or handwriting issue",
];

type FlagState = {
  student: Student;
  record?: TeacherFlag;
  /** Why the system suggests a flag (or Manual when the teacher added one herself). */
  kind: "Automatic" | "Declining" | "Manual" | null;
  status: "suggested" | "confirmed" | "dismissed" | null;
};

const flagDismissReasons = [
  "One-off bad day or absence",
  "Already getting extra support",
  "Not a concern in class",
];

function TeacherRedFlags({
  flagStates,
  threshold,
  setThreshold,
  onDecide,
  gaps,
  onOpenGap,
  scope,
  onScope,
  onNavigate,
  onLogout,
}: {
  flagStates: FlagState[];
  threshold: number;
  setThreshold: (value: number) => void;
  /** Save a decision for a student, or pass null to undo it. */
  onDecide: (studentId: string, record: TeacherFlag | null) => void;
  gaps: LearningGap[];
  onOpenGap: (studentId: string) => void;
  scope: Scope;
  onScope: (scope: Scope) => void;
  onNavigate: (label: string) => void;
  onLogout: () => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panel, setPanel] = useState<{ id: string; mode: "confirm" | "dismiss" } | null>(null);
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);
  const [message, setMessage] = useState("");
  const [addMessage, setAddMessage] = useState("");
  const [reason, setReason] = useState("");
  const [addingId, setAddingId] = useState("");
  const [addReason, setAddReason] = useState("");
  const [ruleOpen, setRuleOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const rowRefs = useRef<Record<string, HTMLElement | null>>({});

  const relevant = flagStates.filter((item) => item.kind && item.status);
  const inView = relevant.filter((item) => inScope(scope, item.student.className));
  const toDecide = inView.filter((item) => item.status === "suggested");
  const confirmed = inView.filter((item) => item.status === "confirmed");
  const dismissed = inView.filter((item) => item.status === "dismissed");
  const flaggable = flagStates.filter(
    (item) => inScope(scope, item.student.className) && !item.status,
  );

  const navItems: NavItem[] = relevant.map((item) => ({
    id: item.student.id,
    name: item.student.name,
    initials: item.student.initials,
    className: item.student.className,
    detail: `Latest ${item.student.latestScore}%`,
    state:
      item.status === "suggested"
        ? "Decide"
        : item.status === "confirmed"
          ? "Flagged"
          : "Dismissed",
    tone: item.status === "suggested" ? "open" : "done",
  }));

  const select = (id: string) => {
    setSelectedId(id);
    const item = relevant.find((entry) => entry.student.id === id);
    if (item && !inScope(scope, item.student.className)) {
      onScope({
        grade: classInfo(item.student.className)?.grade ?? ALL,
        className: item.student.className,
      });
    }
    window.setTimeout(
      () => rowRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "center" }),
      60,
    );
  };

  const openPanel = (item: FlagState, mode: "confirm" | "dismiss") => {
    const first = item.student.name.split(" ")[0];
    setPanel({ id: item.student.id, mode });
    setShowNote(Boolean(item.record?.observation));
    setSelectedId(item.student.id);
    setNote(item.record?.observation ?? "");
    setReason("");
    setMessage(
      `Hi ${first}, I’d like to give you some extra help this week. We’ll practise together, and I know you can do it!`,
    );
  };

  const reasonText = (item: FlagState) => {
    const scores = item.student.scores;
    if (item.kind === "Automatic")
      return `Latest score ${item.student.latestScore}% is at or below ${threshold}%`;
    if (item.kind === "Declining") return `Scores falling: ${scores.join("% → ")}%`;
    return item.record?.observation || "Added by you";
  };

  const addFirst =
    flagStates.find((entry) => entry.student.id === addingId)?.student.name.split(" ")[0] ??
    "the student";
  /** Shows the teacher exactly what the student will receive (same style as the student bell). */
  const messagePreview = (studentFirst: string, text: string) => (
    <div className="flag-preview">
      <span className="flag-preview-label">What {studentFirst} will see</span>
      {text.trim() ? (
        <div className="flag-preview-note">
          <span className="flag-preview-icon">
            <Icon name="message" size={16} />
          </span>
          <div>
            <strong>A message from Ms. Nadia</strong>
            <p>{text}</p>
            <small>Just now</small>
          </div>
        </div>
      ) : (
        <p className="flag-preview-empty">
          Nothing will be sent to {studentFirst}. The flag stays private.
        </p>
      )}
      <span className="flag-preview-hint">
        <Icon name="lock" size={11} /> Private notes and the word “flag” are never shown to
        students.
      </span>
    </div>
  );

  // A render function (not a component) so inputs keep focus while typing.
  const renderRow = (item: FlagState) => {
    const id = item.student.id;
    const first = item.student.name.split(" ")[0];
    const gap = gaps.find((entry) => entry.studentId === id);
    const open = panel?.id === id;
    return (
      <article
        key={id}
        ref={(element) => {
          rowRefs.current[id] = element;
        }}
        className={`flag-row ${item.status} ${selectedId === id ? "focused" : ""}`}
      >
        <div className="flag-row-main">
          <div className="workflow-student">
            <span className="avatar avatar-table">{item.student.initials}</span>
            <div>
              <ProfileLink studentId={item.student.id} name={item.student.name} />
              <span>{shortClass(item.student.className)}</span>
            </div>
          </div>
          <div className="flag-row-score">
            <strong className={item.student.latestScore <= threshold ? "low" : ""}>
              {item.student.latestScore}%
            </strong>
            <div className="flag-row-history">
              {item.student.scores.map((score, index) => (
                <b key={`${score}-${index}`}>{score}</b>
              ))}
            </div>
          </div>
          <div className="flag-row-reason">
            <Badge
              type={
                item.kind === "Automatic"
                  ? "danger"
                  : item.kind === "Declining"
                    ? "warning"
                    : "blue"
              }
            >
              {item.kind === "Automatic"
                ? "AI · below threshold"
                : item.kind === "Declining"
                  ? "AI · falling scores"
                  : "Added by you"}
            </Badge>
            <span>{reasonText(item)}</span>
          </div>
          <div className="flag-row-actions">
            {item.status === "suggested" ? (
              <>
                <Button onClick={() => openPanel(item, "confirm")}>
                  <Icon name="flag" size={14} /> Confirm flag
                </Button>
                <Button variant="secondary" onClick={() => openPanel(item, "dismiss")}>
                  Dismiss
                </Button>
              </>
            ) : (
              <>
                {gap && gap.status !== "dismissed" && (
                  <span className={`rf-gap-chip ${gap.status}`}>
                    Learning gap: {gap.status === "confirmed" ? "confirmed" : "suggested"}
                  </span>
                )}
                <Button variant="secondary" onClick={() => onDecide(id, null)}>
                  Undo
                </Button>
              </>
            )}
          </div>
        </div>

        {item.status !== "suggested" && item.record && (
          <div className={`flag-decision ${item.status}`}>
            {item.status === "confirmed" ? (
              <Icon name="flag" size={14} />
            ) : (
              <Icon name="check" size={14} />
            )}
            <div className="flag-decision-text">
              <strong>{item.status === "confirmed" ? "Flagged by you" : "Dismissed by you"}</strong>
              {item.record.observation && (
                <span className="flag-private">
                  <Icon name="lock" size={12} /> Private: {item.record.observation}
                </span>
              )}
              {item.record.studentNote && (
                <span className="flag-sent">
                  <Icon name="bell" size={12} /> Sent to {first}: “{item.record.studentNote}”
                </span>
              )}
            </div>
          </div>
        )}

        {open && panel.mode === "confirm" && (
          <div className="flag-panel">
            <div className="flag-panel-grid">
              <div>
                <label className="flag-field">
                  <span>
                    <Icon name="bell" size={13} /> Message to {first}{" "}
                    <i>· {first} sees this in his notifications (optional)</i>
                  </span>
                  <textarea value={message} onChange={(event) => setMessage(event.target.value)} />
                </label>
                {showNote ? (
                  <label className="flag-field private">
                    <span>
                      <Icon name="lock" size={13} /> Private note <i>· only you see this</i>
                    </span>
                    <input
                      value={note}
                      autoFocus
                      onChange={(event) => setNote(event.target.value)}
                      placeholder="e.g. Loses focus after recess. Talk to parents at the next meeting."
                    />
                  </label>
                ) : (
                  <button className="flag-add-note" onClick={() => setShowNote(true)}>
                    <Icon name="lock" size={13} /> + Add a private note (only you see it)
                  </button>
                )}
              </div>
              {messagePreview(first, message)}
            </div>
            <div className="override-actions">
              <Button
                onClick={() => {
                  onDecide(id, {
                    studentId: id,
                    type: item.kind === "Manual" ? "Manual" : "Automatic",
                    status: "confirmed",
                    observation: note.trim(),
                    studentNote: message.trim() || undefined,
                  });
                  setPanel(null);
                  setShowNote(false);
                }}
              >
                <Icon name="flag" size={14} /> Confirm flag
                {message.trim() ? " & send message" : ""}
              </Button>
              <Button variant="ghost" onClick={() => setPanel(null)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {open && panel.mode === "dismiss" && (
          <div className="flag-panel">
            <span>
              <Icon name="lock" size={13} /> Why are you dismissing it?{" "}
              <i>· private, nothing is sent</i>
            </span>
            <div className="dismiss-chips">
              {flagDismissReasons.map((choice) => (
                <button
                  key={choice}
                  className={reason === choice ? "active" : ""}
                  onClick={() => setReason(choice)}
                >
                  {choice}
                </button>
              ))}
            </div>
            <div className="override-actions">
              <Button
                variant="secondary"
                disabled={!reason}
                onClick={() => {
                  onDecide(id, {
                    studentId: id,
                    type: item.kind === "Manual" ? "Manual" : "Automatic",
                    status: "dismissed",
                    observation: reason,
                  });
                  setPanel(null);
                }}
              >
                Dismiss flag
              </Button>
              <Button variant="ghost" onClick={() => setPanel(null)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </article>
    );
  };

  return (
    <PortalLayout role="teacher" active="Red Flags" onNavigate={onNavigate} onLogout={onLogout}>
      <Topbar
        title="Red Flags"
        subtitle="The AI suggests students who may need extra support. You decide who is flagged."
      />
      <div className="content teacher-workflow-content rf">
        <ClassNavigator
          scope={scope}
          onScope={onScope}
          items={navItems}
          selectedId={selectedId ?? undefined}
          onSelect={select}
          noun="flag suggestions"
          listMode
        />

        <div className="rf-rule-line">
          <span>
            AI suggests a flag when the latest score is at or below <b>{threshold}%</b>, or scores
            keep falling.
          </span>
          <button className="text-button" onClick={() => setRuleOpen((value) => !value)}>
            <Icon name="filter" size={14} /> {ruleOpen ? "Close" : "Change rule"}
          </button>
        </div>
        {ruleOpen && (
          <section className="card rf-threshold">
            <div className="rf-threshold-text">
              <span className="threshold-icon">
                <Icon name="flag" />
              </span>
              <div>
                <div className="section-title">Automatic suggestion rule</div>
                <p>
                  Suggest a flag when the latest score is at or below <b>{threshold}%</b>. Falling
                  scores are suggested too. Your decisions are kept if you change the rule.
                </p>
              </div>
            </div>
            <div className="threshold-control">
              <input
                type="range"
                min="40"
                max="80"
                step="5"
                value={threshold}
                aria-label="Score threshold"
                onChange={(event) => setThreshold(Number(event.target.value))}
              />
              <strong>{threshold}%</strong>
            </div>
          </section>
        )}

        <section className="rf-section">
          <div className="rf-section-head">
            <div className="section-title">Needs your decision</div>
            <Badge type={toDecide.length ? "warning" : "success"}>
              {toDecide.length ? `${toDecide.length} to decide` : "All decided"}
            </Badge>
          </div>
          {toDecide.length ? (
            toDecide.map((item) => renderRow(item))
          ) : (
            <p className="rf-empty">No flag suggestions waiting in {scopeLabel(scope)}.</p>
          )}
        </section>

        {confirmed.length > 0 && (
          <section className="rf-section">
            <div className="rf-section-head">
              <div className="section-title">Flagged students</div>
              <Badge type="danger">{confirmed.length}</Badge>
            </div>
            {confirmed.map((item) => renderRow(item))}
          </section>
        )}

        {dismissed.length > 0 && (
          <section className="rf-section">
            <div className="rf-section-head">
              <div className="section-title">Dismissed</div>
              <Badge type="neutral">{dismissed.length}</Badge>
            </div>
            {dismissed.map((item) => renderRow(item))}
          </section>
        )}

        {!addOpen ? (
          <button className="rf-add-open" onClick={() => setAddOpen(true)}>
            <Icon name="plus" size={15} /> Flag another student
          </button>
        ) : (
          <section className="card rf-add">
            <div>
              <div className="section-title">Flag another student</div>
              <p>
                For a student the rule did not catch, for example someone working below their usual
                level.
              </p>
            </div>
            <div className="rf-add-grid">
              <div className="rf-add-fields">
                <label className="flag-field">
                  <span>Student</span>
                  <select value={addingId} onChange={(event) => setAddingId(event.target.value)}>
                    <option value="">Choose a student…</option>
                    {flaggable.map((item) => (
                      <option key={item.student.id} value={item.student.id}>
                        {item.student.name} · {shortClass(item.student.className)} ·{" "}
                        {item.student.latestScore}%
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flag-field private">
                  <span>
                    <Icon name="lock" size={13} /> Private reason <b>(required)</b>{" "}
                    <i>· only you see this</i>
                  </span>
                  <input
                    value={addReason}
                    onChange={(event) => setAddReason(event.target.value)}
                    placeholder="e.g. Working below her usual level since the holiday"
                  />
                </label>
                <label className="flag-field">
                  <span>
                    <Icon name="bell" size={13} /> Message to {addFirst}{" "}
                    <i>· sent to their notifications (optional)</i>
                  </span>
                  <textarea
                    value={addMessage}
                    disabled={!addingId}
                    onChange={(event) => setAddMessage(event.target.value)}
                    placeholder={
                      addingId
                        ? `Hi ${addFirst}, I’d like to give you some extra help this week…`
                        : "Choose a student first"
                    }
                  />
                </label>
                <Button
                  disabled={!addingId || !addReason.trim()}
                  onClick={() => {
                    onDecide(addingId, {
                      studentId: addingId,
                      type: "Manual",
                      status: "confirmed",
                      observation: addReason.trim(),
                      studentNote: addMessage.trim() || undefined,
                    });
                    setAddingId("");
                    setAddReason("");
                    setAddMessage("");
                    setAddOpen(false);
                  }}
                >
                  <Icon name="flag" size={14} /> Add flag
                  {addMessage.trim() ? " & send message" : ""}
                </Button>
              </div>
              {addingId && messagePreview(addFirst, addMessage)}
            </div>
          </section>
        )}
      </div>
    </PortalLayout>
  );
}

/**
 * Mock "AI" answer suggestion for practice questions the teacher writes herself.
 * It only handles simple arithmetic and fraction comparisons, and says so honestly otherwise.
 * The teacher always confirms the answer before it is used.
 */
function suggestPracticeAnswer(
  text: string,
): { answer: string; accepted: string[]; check: "auto" | "teacher" } | null {
  const lower = text.toLowerCase();
  if (/(explain|draw|why|describe|show your|in your own words)/.test(lower)) {
    const fractions = [...text.matchAll(/(\d+)\s*\/\s*(\d+)/g)].map((m) => ({
      label: `${m[1]}/${m[2]}`,
      value: Number(m[1]) / Number(m[2]),
    }));
    if (fractions.length === 2) {
      const [a, b] = fractions;
      if (Math.abs(a.value - b.value) < 1e-9)
        return {
          answer: `${a.label} = ${b.label} (they are equal)`,
          accepted: [],
          check: "teacher",
        };
      const bigger = a.value > b.value ? a : b;
      return { answer: `${bigger.label} is larger`, accepted: [], check: "teacher" };
    }
    return { answer: "", accepted: [], check: "teacher" };
  }
  const fractions = [...text.matchAll(/(\d+)\s*\/\s*(\d+)/g)].map((m) => ({
    label: `${m[1]}/${m[2]}`,
    value: Number(m[1]) / Number(m[2]),
  }));
  if (fractions.length >= 3 && /order|least|greatest|smallest/.test(lower)) {
    const sorted = [...fractions].sort((a, b) =>
      /greatest to least|largest to smallest/.test(lower) ? b.value - a.value : a.value - b.value,
    );
    const answer = sorted.map((item) => item.label).join(", ");
    return { answer, accepted: [sorted.map((item) => item.label).join(" ")], check: "auto" };
  }
  if (fractions.length === 2) {
    const [a, b] = fractions;
    if (/[<>=]|compare/.test(lower)) {
      const symbol = a.value > b.value ? ">" : a.value < b.value ? "<" : "=";
      return { answer: `${a.label} ${symbol} ${b.label}`, accepted: [], check: "auto" };
    }
    if (/larger|bigger|greater|more|smaller|less/.test(lower)) {
      const wantSmall = /smaller|less/.test(lower);
      const pick = a.value > b.value !== wantSmall ? a : b;
      return {
        answer: pick.label,
        accepted: [`${pick.label} is ${wantSmall ? "smaller" : "larger"}`],
        check: "auto",
      };
    }
  }
  const sum = text.match(/(\d+)\s*([+\-−×x*])\s*(\d+)/);
  if (sum) {
    const left = Number(sum[1]);
    const right = Number(sum[3]);
    const value =
      sum[2] === "+"
        ? left + right
        : sum[2] === "-" || sum[2] === "−"
          ? left - right
          : left * right;
    return { answer: String(value), accepted: [], check: "auto" };
  }
  return null;
}

type FeedbackItem = {
  /** Same id as the grade task. */
  id: string;
  studentId: string;
  studentName: string;
  initials: string;
  className: string;
  title: string;
  subject: string;
  gradeFinal: boolean;
  finalScore?: number;
  gap?: { status: LearningGap["status"]; title: string; topic: string };
  draft: FeedbackDraft;
  /** The student's finished practice (only for the student portal demo: Omar). */
  practice?: PracticeResult | null;
};

type ReviewMarks = Record<string, { mark?: "correct" | "not-yet"; comment?: string }>;

const startsWithStrength = (message: string) =>
  /^(great|nice|excellent|wonderful|good|well done|strong work|you did|fantastic|brilliant)/i.test(
    message.trim(),
  );

function TeacherFeedbackApproval({
  items,
  selectedId,
  onSelect,
  onUpdate,
  onSend,
  onReviewPractice,
  onOpenGrade,
  gapFor,
  onUpdateGap,
  scope,
  onScope,
  onNavigate,
  onLogout,
}: {
  gapFor: (examId: string) => LearningGap | undefined;
  onUpdateGap: (id: string, changes: Partial<LearningGap>) => void;
  items: FeedbackItem[];
  selectedId: string;
  onSelect: (id: string) => void;
  onUpdate: (id: string, changes: Partial<FeedbackDraft>) => void;
  onSend: (id: string) => void;
  onReviewPractice: (id: string, marks: ReviewMarks) => void;
  onOpenGrade: (taskId: string) => void;
  scope: Scope;
  onScope: (scope: Scope) => void;
  onNavigate: (label: string) => void;
  onLogout: () => void;
}) {
  const stages = useContext(ReviewStepsContext);
  // ----- practice question editor (teacher confirms every answer) -----
  const [editor, setEditor] = useState<{
    index: number | "new";
    text: string;
    check: "auto" | "teacher";
    answer: string;
  } | null>(null);
  const [reviewMarks, setReviewMarks] = useState<ReviewMarks>({});
  // After sending, the screen shows ONE thing at a time: the practice answers, or what was sent.
  const [sentTab, setSentTab] = useState<"practice" | "sent">("practice");
  const practiceToCheck = (entry: FeedbackItem) =>
    entry.draft.sent && Boolean(entry.practice?.completed) && !entry.practice?.reviewed;

  const blocker = (item: FeedbackItem) => (!item.gradeFinal ? "grade" : null);
  const item = pickInScope(
    items,
    scope,
    selectedId,
    (entry) => (!blocker(entry) && !entry.draft.sent) || practiceToCheck(entry),
  );

  // Keep the AI draft in line with the gap decision until the teacher writes her own text.
  const gapStatus = item?.gap?.status;
  useEffect(() => {
    setEditor(null);
    setReviewMarks({});
    setSentTab("practice");
    if (!item) return;
    const { draft } = item;
    const confirmed = gapStatus === "confirmed";
    if (
      confirmed &&
      draft.message === draft.aiMessageNoGap &&
      draft.aiMessage !== draft.aiMessageNoGap
    )
      onUpdate(item.id, { message: draft.aiMessage });
    if (!confirmed && draft.message === draft.aiMessage && draft.aiMessage !== draft.aiMessageNoGap)
      onUpdate(item.id, { message: draft.aiMessageNoGap });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id, gapStatus]);

  const navItems: NavItem[] = items.map((entry) => {
    const block = blocker(entry);
    return {
      id: entry.id,
      name: entry.studentName,
      initials: entry.initials,
      className: entry.className,
      detail: entry.title,
      state: practiceToCheck(entry)
        ? "Practice to check"
        : entry.draft.sent
          ? "Sent"
          : block === "grade"
            ? "Grade first"
            : "Ready to send",
      tone: practiceToCheck(entry) ? "open" : entry.draft.sent ? "done" : block ? "wait" : "open",
    };
  });

  const navigator = <GradingQueue examId={item?.id} />;
  const stepBar = <ReviewSteps examId={item?.id} current="feedback" />;

  const shell = (children: ReactNode, framed = true) => (
    <PortalLayout role="teacher" active="Feedback" onNavigate={onNavigate} onLogout={onLogout}>
      <Topbar
        title="Feedback & Learning Gap"
        subtitle="Check the message the student will receive, and decide on any learning gap."
      />
      <div className="content teacher-workflow-content gw fb">
        {navigator}
        {stepBar}
        {framed ? <div className="sw">{children}</div> : children}
      </div>
    </PortalLayout>
  );

  if (!item)
    return shell(
      <ScopeEmpty scope={scope} onScope={onScope} items={navItems} noun="feedback to send" />,
      false,
    );

  const { draft } = item;
  const firstName = item.studentName.split(" ")[0];
  const block = blocker(item);
  const practiceAvailable = item.gap?.status === "confirmed" && draft.questions.length > 0;
  const autoCount = draft.questions.filter((question) => question.check === "auto").length;
  const missingAnswers = draft.questions.filter(
    (question) => question.check === "auto" && !question.answer.trim(),
  ).length;
  const openEditor = (index: number | "new") => {
    const question = index === "new" ? undefined : draft.questions[index];
    setEditor({
      index,
      text: question?.text ?? "",
      check: question?.check ?? "auto",
      answer: question?.answer ?? "",
    });
  };
  const suggestion = editor ? suggestPracticeAnswer(editor.text) : null;
  const saveEditor = () => {
    if (!editor) return;
    const previous = editor.index === "new" ? undefined : draft.questions[editor.index];
    const answerChanged = previous?.answer !== editor.answer.trim();
    const saved: PracticeQuestion = {
      id: previous?.id ?? `custom-${Date.now()}`,
      text: editor.text.trim(),
      check: editor.check,
      answer: editor.answer.trim(),
      accepted: answerChanged ? (suggestion?.accepted ?? []) : (previous?.accepted ?? []),
      // Saved by the teacher = she has confirmed this answer.
      answerSource: "teacher",
      hint: previous && !answerChanged ? previous.hint : undefined,
      reason: previous && !answerChanged ? previous.reason : undefined,
    };
    onUpdate(item.id, {
      questions:
        editor.index === "new"
          ? [...draft.questions, saved]
          : draft.questions.map((question, index) => (index === editor.index ? saved : question)),
      practiceApproved: false,
    });
    setEditor(null);
  };
  const questionEditor = editor && (
    <div className="fb-editor">
      <label>
        <span>Question</span>
        <input
          value={editor.text}
          autoFocus
          onChange={(event) => setEditor({ ...editor, text: event.target.value })}
          placeholder="e.g. Which is larger: 5/6 or 7/8?"
        />
      </label>
      <div className="fb-editor-row">
        <span>Who checks the answer?</span>
        <div className="fb-editor-seg" role="group">
          <button
            className={editor.check === "auto" ? "active" : ""}
            onClick={() => setEditor({ ...editor, check: "auto" })}
          >
            LearnLens checks it
          </button>
          <button
            className={editor.check === "teacher" ? "active" : ""}
            onClick={() => setEditor({ ...editor, check: "teacher" })}
          >
            I check it myself
          </button>
        </div>
      </div>
      <label>
        <span>
          {editor.check === "auto" ? (
            <>
              Correct answer <b>(required)</b>
            </>
          ) : (
            <>
              Model answer <i>(optional, only you see it)</i>
            </>
          )}
        </span>
        <input
          value={editor.answer}
          onChange={(event) => setEditor({ ...editor, answer: event.target.value })}
          placeholder={editor.check === "auto" ? "e.g. 7/8" : "What a good answer looks like"}
        />
      </label>
      {editor.text.trim() &&
        (suggestion?.answer ? (
          suggestion.answer !== editor.answer.trim() && (
            <div className="fb-editor-ai">
              <Icon name="spark" size={13} />
              <span>
                AI suggests: <b>{suggestion.answer}</b>
                {suggestion.check === "teacher" ? " (open answer, best checked by you)" : ""}
              </span>
              <button
                onClick={() =>
                  setEditor({ ...editor, answer: suggestion.answer, check: suggestion.check })
                }
              >
                Use it
              </button>
            </div>
          )
        ) : (
          <div className="fb-editor-ai muted">
            <Icon name="spark" size={13} />
            <span>
              {suggestion?.check === "teacher"
                ? "This looks like an open question. It's best if you check it yourself."
                : "The AI can't work out an answer for this one. Type it, or choose “I check it myself”."}
            </span>
          </div>
        ))}
      <div className="override-actions">
        <Button
          disabled={!editor.text.trim() || (editor.check === "auto" && !editor.answer.trim())}
          onClick={saveEditor}
        >
          <Icon name="check" size={14} />{" "}
          {editor.index === "new" ? "Add question" : "Save question"}
        </Button>
        <Button variant="ghost" onClick={() => setEditor(null)}>
          Cancel
        </Button>
      </div>
    </div>
  );
  // Practice assignments are created from the Practice page, not sent with feedback.
  const includePractice = false && practiceAvailable && draft.sendPractice;
  const fullGap = gapFor(item.id);
  const teacherItems = item.practice?.items.filter((record) => record.check === "teacher") ?? [];
  const unmarked = teacherItems.filter((record) => !reviewMarks[record.questionId]?.mark).length;
  const reviewPreview =
    (item.practice?.correct ?? 0) +
    teacherItems.filter((record) => reviewMarks[record.questionId]?.mark === "correct").length;
  const setMark = (
    questionId: string,
    change: { mark?: "correct" | "not-yet"; comment?: string },
  ) =>
    setReviewMarks((current) => ({
      ...current,
      [questionId]: { ...current[questionId], ...change },
    }));
  const strengthFirst = startsWithStrength(draft.message);
  const editedByTeacher =
    draft.message !== draft.aiMessage && draft.message !== draft.aiMessageNoGap;
  const canSend =
    !draft.sent &&
    !block &&
    draft.message.trim().length > 0 &&
    strengthFirst &&
    (!includePractice || draft.practiceApproved) &&
    (!fullGap || fullGap.status !== "suggested") &&
    !editor;
  const sendHint = !draft.message.trim()
    ? "Write a message first"
    : !strengthFirst
      ? "Start the message with something the student did well"
      : fullGap?.status === "suggested"
        ? "Confirm the learning gap, or mark it as not a gap"
        : "";
  const nextItem =
    items.find(
      (entry) =>
        entry.id !== item.id &&
        !entry.draft.sent &&
        !blocker(entry) &&
        inScope(scope, entry.className),
    ) ?? items.find((entry) => entry.id !== item.id && !entry.draft.sent && !blocker(entry));

  const examBar = (
    <section className="workflow-exam-bar">
      <div className="workflow-student">
        <span className="avatar avatar-navy">{item.initials}</span>
        <div>
          <ProfileLink studentId={item.studentId} name={item.studentName} />
          <span>
            {shortClass(item.className)} · {item.title}
          </span>
        </div>
      </div>
      <div className="workflow-exam-meta">
        <Badge type="blue">{item.subject}</Badge>
        {item.gap && (
          <span className={`fb-gap-chip ${item.gap.status}`}>
            Learning gap:{" "}
            {item.gap.status === "confirmed"
              ? "confirmed"
              : item.gap.status === "dismissed"
                ? "dismissed"
                : "not decided"}
          </span>
        )}
      </div>
      <div className="fb-final">
        <span>Final grade</span>
        <strong>
          {item.gradeFinal && item.finalScore !== undefined ? `${item.finalScore}%` : "–"}
        </strong>
      </div>
    </section>
  );

  if (block)
    return shell(
      <>
        {examBar}
        <section className="card ocr-reading-state">
          <span className="ocr-reading-icon">
            <Icon name={block === "grade" ? "grade" : "journey"} size={28} />
          </span>
          <div className="section-title">
            {block === "grade"
              ? `Finalize ${firstName}'s grade first`
              : `Decide on ${firstName}'s learning gap first`}
          </div>
          <p>
            {block === "grade"
              ? "Feedback includes the final grade, so it can only be sent after every score is confirmed."
              : "Targeted practice depends on your decision: confirm the gap to add practice, or dismiss it to send feedback only."}
          </p>
          <Button onClick={() => onOpenGrade(item.id)}>
            {block === "grade" ? "Go to Grade Review" : "Go to Grading"} <Icon name="arrow" />
          </Button>
        </section>
      </>,
    );

  const hasAiAnswers = draft.questions.some(
    (question) => question.check === "auto" && question.answerSource === "ai",
  );

  // ---------- 1 · message ----------
  const messageCard = (
    <section className="card fb-card">
      <div className="fb-card-head">
        <div>
          <div className="section-title">Message to {firstName}</div>
          <p>Start with a strength, then one clear next step.</p>
        </div>
        {editedByTeacher ? (
          <Badge type="blue">Written by you</Badge>
        ) : (
          <Badge type="ai">
            <Icon name="spark" size={12} /> AI draft
          </Badge>
        )}
      </div>
      <textarea
        className="fb-message"
        value={draft.message}
        disabled={draft.sent}
        onChange={(event) => onUpdate(item.id, { message: event.target.value })}
      />
      {!draft.sent && (
        <div className="fb-message-foot">
          <span className={`fb-check ${strengthFirst ? "ok" : "warn"}`}>
            <Icon name={strengthFirst ? "check" : "flag"} size={13} />
            {strengthFirst
              ? "Starts with encouragement"
              : "Start with something the student did well"}
          </span>
          {editedByTeacher && (
            <button
              className="text-button"
              onClick={() =>
                onUpdate(item.id, {
                  message:
                    item.gap?.status === "confirmed" ? draft.aiMessage : draft.aiMessageNoGap,
                })
              }
            >
              Use AI draft again
            </button>
          )}
        </div>
      )}
    </section>
  );

  // ---------- 2 · practice questions (one tidy table) ----------
  const practiceCard = (
    <section className="card fb-card">
      <div className="fb-card-head">
        <div>
          <div className="section-title">Practice questions</div>
          <p>
            {practiceAvailable
              ? `For the confirmed gap: ${item.gap?.topic}.`
              : "Practice is only created for a confirmed learning gap."}
          </p>
        </div>
        {practiceAvailable && !draft.sent && (
          <label className="fb-switch">
            <input
              type="checkbox"
              checked={draft.sendPractice}
              onChange={(event) => onUpdate(item.id, { sendPractice: event.target.checked })}
            />
            <span>Include practice</span>
          </label>
        )}
      </div>

      {!practiceAvailable ? (
        <div className="fb-no-practice">
          {item.gap?.status === "dismissed"
            ? `You dismissed the learning gap, so ${firstName} gets feedback only.`
            : `No learning gap was found for this exam, so ${firstName} gets feedback only.`}
        </div>
      ) : !draft.sendPractice ? (
        <div className="fb-no-practice">Practice turned off. {firstName} gets feedback only.</div>
      ) : (
        <>
          <div className="fb-qt">
            <div className="fb-qt-head">
              <span>#</span>
              <span>Question</span>
              <span>Correct answer</span>
              <span>Checked by</span>
              <span />
            </div>
            {draft.questions.map((question, index) =>
              editor?.index === index ? (
                <div key={question.id} className="fb-qt-editing">
                  {questionEditor}
                </div>
              ) : (
                <div key={question.id} className="fb-qt-row">
                  <span className="fb-qt-num">{index + 1}</span>
                  <p className="fb-qt-text">{question.text}</p>
                  <span className={`fb-qt-answer ${question.check}`}>
                    {question.check === "auto" && question.answerSource === "ai" && !draft.sent && (
                      <Icon name="spark" size={11} />
                    )}
                    {question.answer || "Open answer"}
                  </span>
                  <span className={`fb-qt-who ${question.check}`}>
                    {question.check === "auto" ? "LearnLens" : "You"}
                  </span>
                  <span className="fb-qt-actions">
                    {!draft.sent && !editor && (
                      <>
                        <button aria-label="Edit question" onClick={() => openEditor(index)}>
                          <Icon name="practice" size={14} />
                        </button>
                        <button
                          aria-label="Remove question"
                          disabled={draft.questions.length <= 1}
                          onClick={() =>
                            onUpdate(item.id, {
                              questions: draft.questions.filter(
                                (_, entryIndex) => entryIndex !== index,
                              ),
                              practiceApproved: false,
                            })
                          }
                        >
                          <Icon name="trash" size={14} />
                        </button>
                      </>
                    )}
                  </span>
                </div>
              ),
            )}
            {editor?.index === "new" && <div className="fb-qt-editing">{questionEditor}</div>}
          </div>
          {!draft.sent && (
            <>
              <div className="fb-qt-foot">
                {!editor && (
                  <button className="fb-add-question-button" onClick={() => openEditor("new")}>
                    + Add your own question
                  </button>
                )}
                {hasAiAnswers && (
                  <span className="fb-qt-ai">
                    <Icon name="spark" size={12} /> = answer suggested by AI. Check it before you
                    approve.
                  </span>
                )}
              </div>
              <label
                className={`fb-approve ${draft.practiceApproved ? "on" : ""} ${missingAnswers ? "blocked" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={draft.practiceApproved}
                  disabled={missingAnswers > 0 || Boolean(editor)}
                  onChange={(event) =>
                    onUpdate(item.id, {
                      practiceApproved: event.target.checked,
                      // Approving means the teacher has checked every answer.
                      questions: event.target.checked
                        ? draft.questions.map((question) => ({
                            ...question,
                            answerSource: "teacher" as const,
                          }))
                        : draft.questions,
                    })
                  }
                />
                <span>
                  <strong>
                    I checked these {draft.questions.length} questions and their answers
                  </strong>
                  <small>
                    {missingAnswers
                      ? `${missingAnswers} question${missingAnswers > 1 ? "s need" : " needs"} a correct answer first.`
                      : `LearnLens marks ${autoCount}, you mark ${draft.questions.length - autoCount}.`}
                  </small>
                </span>
              </label>
            </>
          )}
        </>
      )}
    </section>
  );

  // ---------- learning gap (only the teacher sees this) ----------
  const gapCard = (
    <section className={`card fb-card fb-gap ${fullGap ? fullGap.status : "none"}`}>
      <div className="fb-card-head">
        <div>
          <div className="section-title">Learning gap</div>
          <p>
            {fullGap
              ? `LearnLens found the same mistake more than once. Only you see this, never ${firstName}.`
              : `LearnLens did not find a repeated mistake in ${firstName}'s exam.`}
          </p>
        </div>
        {fullGap &&
          (fullGap.status === "confirmed" ? (
            <Badge type="success">
              <Icon name="check" size={12} /> Confirmed by you
            </Badge>
          ) : fullGap.status === "dismissed" ? (
            <Badge type="neutral">Not a gap</Badge>
          ) : (
            <Badge type="ai">
              <Icon name="spark" size={12} /> AI suggestion · not final
            </Badge>
          ))}
      </div>
      {!fullGap ? (
        <div className="fb-no-practice">No learning gap identified for this exam.</div>
      ) : (
        <>
          <div className="fb-gap-topic">
            <span>{fullGap.topic}</span>
            <strong>{fullGap.title}</strong>
          </div>
          <label className="fb-gap-note">
            <span>
              My notes{" "}
              <i>
                {fullGap.description === fullGap.aiDescription
                  ? "· LearnLens wrote a first draft, edit it if you like"
                  : "· shown in the student's profile under Learning gaps"}
              </i>
            </span>
            <textarea
              value={fullGap.description}
              disabled={draft.sent}
              onChange={(event) => onUpdateGap(fullGap.id, { description: event.target.value })}
            />
          </label>
          {!draft.sent && (
            <div className="fb-gap-actions">
              <button
                className={fullGap.status === "confirmed" ? "chosen ok" : ""}
                onClick={() =>
                  onUpdateGap(fullGap.id, { status: "confirmed", dismissReason: undefined })
                }
              >
                <Icon name="check" size={15} />
                {fullGap.status === "confirmed" ? "Gap confirmed" : "Confirm gap"}
              </button>
              <button
                className={fullGap.status === "dismissed" ? "chosen no" : ""}
                onClick={() =>
                  onUpdateGap(fullGap.id, {
                    status: "dismissed",
                    dismissReason: "Not a real gap (decided while writing feedback).",
                  })
                }
              >
                <Icon name="flag" size={15} />
                {fullGap.status === "dismissed" ? "Marked as not a gap" : "Not a gap"}
              </button>
              {fullGap.description !== fullGap.aiDescription && (
                <button
                  className="text-button"
                  onClick={() => onUpdateGap(fullGap.id, { description: fullGap.aiDescription })}
                >
                  Use LearnLens note again
                </button>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );

  // ---------- student preview ----------

  const composeGrid = (
    <div className="fb-grid">
      <div className="fb-main">
        {messageCard}
        {gapCard}
      </div>
    </div>
  );

  // ---------- practice answers (after the student has practised) ----------
  const practice = item.practice?.completed ? item.practice : null;
  const autoItems = practice?.items.filter((record) => record.check === "auto") ?? [];
  const autoRight = autoItems.filter((record) => record.correct).length;
  const numberOf = (questionId: string) =>
    (practice?.items.findIndex((record) => record.questionId === questionId) ?? 0) + 1;
  const scoreNow = practice?.reviewed ? (practice.finalCorrect ?? 0) : reviewPreview;

  const reviewPanel = !practice ? (
    <section className="fb-rv-empty">
      <span>
        <Icon name="practice" size={22} />
      </span>
      <strong>{firstName} hasn’t finished the practice yet</strong>
      <p>The answers will appear here. Open answers will wait for you to mark them.</p>
    </section>
  ) : (
    <section className="fb-rv">
      <header className="fb-rv-head">
        <div>
          <div className="section-title">{firstName}’s practice answers</div>
          <p>
            {practice.reviewed
              ? `You checked everything and sent the result to ${firstName}.`
              : teacherItems.length
                ? `LearnLens marked ${autoItems.length}. ${teacherItems.length === 1 ? "1 open answer needs" : `${teacherItems.length} open answers need`} you.`
                : "Everything was marked automatically."}
          </p>
        </div>
        <div className={`fb-rv-score ${practice.reviewed ? "final" : ""}`}>
          <strong>
            {scoreNow}
            <i>/{practice.total}</i>
          </strong>
          <span>{practice.reviewed ? "right" : unmarked ? "right so far" : "right"}</span>
        </div>
      </header>

      {teacherItems.length > 0 && (
        <div className="fb-rv-group">
          <h3>
            {practice.reviewed ? "Marked by you" : "Needs your check"}
            {!practice.reviewed && unmarked > 0 && <em className="warn">{unmarked} to mark</em>}
          </h3>
          {teacherItems.map((record) => {
            const mark = practice.reviewed
              ? record.teacherMark
              : reviewMarks[record.questionId]?.mark;
            return (
              <article
                key={record.questionId}
                className={`fb-rv-open ${mark ?? "todo"} ${practice.reviewed ? "locked" : ""}`}
              >
                <div className="fb-rv-open-q">
                  <span className="fb-qt-num">{numberOf(record.questionId)}</span>
                  <p>{record.question}</p>
                </div>
                <blockquote>
                  <small>{firstName} wrote</small>
                  {record.answer || "–"}
                </blockquote>
                {record.modelAnswer && (
                  <p className="fb-rv-model">
                    <b>Your model answer:</b> {record.modelAnswer}
                  </p>
                )}
                {practice.reviewed ? (
                  <p className={`fb-rv-verdict ${record.teacherMark === "correct" ? "ok" : "no"}`}>
                    <Icon name={record.teacherMark === "correct" ? "check" : "flag"} size={13} />
                    {record.teacherMark === "correct" ? "Correct" : "Incorrect"}
                    {record.teacherComment ? <i>“{record.teacherComment}”</i> : null}
                  </p>
                ) : (
                  <div className="fb-rv-mark">
                    <div className="fb-rv-buttons" role="group" aria-label="Your decision">
                      <button
                        className={mark === "correct" ? "active ok" : ""}
                        onClick={() => setMark(record.questionId, { mark: "correct" })}
                      >
                        <Icon name="check" size={13} /> Correct
                      </button>
                      <button
                        className={mark === "not-yet" ? "active no" : ""}
                        onClick={() => setMark(record.questionId, { mark: "not-yet" })}
                      >
                        Incorrect
                      </button>
                    </div>
                    <input
                      value={reviewMarks[record.questionId]?.comment ?? ""}
                      onChange={(event) =>
                        setMark(record.questionId, { comment: event.target.value })
                      }
                      placeholder={`Comment for ${firstName} (optional)`}
                    />
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {autoItems.length > 0 && (
        <div className="fb-rv-group">
          <h3>
            Marked by LearnLens
            <em>
              {autoRight} of {autoItems.length} right
            </em>
          </h3>
          <div className="fb-rv-table">
            <div className="fb-rv-row head">
              <span>#</span>
              <span>Question</span>
              <span>{firstName} wrote</span>
              <span>Correct answer</span>
              <span />
            </div>
            {autoItems.map((record) => (
              <div key={record.questionId} className={`fb-rv-row ${record.correct ? "ok" : "no"}`}>
                <span className="fb-qt-num">{numberOf(record.questionId)}</span>
                <p>{record.question}</p>
                <b className="wrote">{record.answer || "–"}</b>
                <span className="right">{record.correct ? "–" : record.modelAnswer}</span>
                <span className="fb-rv-chip">
                  {record.correct ? <Icon name="check" size={12} /> : <i>✕</i>}
                  {record.correct ? "Right" : "Wrong"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!practice.reviewed && (
        <footer className="fb-rv-foot">
          <span>
            {unmarked
              ? `Mark ${unmarked} more answer${unmarked === 1 ? "" : "s"} to send the result.`
              : `${firstName} will see: ${reviewPreview} of ${practice.total} right, with your comments.`}
          </span>
          <Button
            disabled={unmarked > 0}
            onClick={() => {
              onReviewPractice(item.id, reviewMarks);
              setReviewMarks({});
            }}
          >
            Send practice result to {firstName} <Icon name="arrow" />
          </Button>
        </footer>
      )}
    </section>
  );

  const waitingOthers = (stages?.queue ?? []).filter(
    (entry) => entry.actionRequired && entry.examId !== item.id,
  );
  const nextStudent =
    waitingOthers.find((entry) => queueMatches(entry, stages?.filter ?? "all")) ?? waitingOthers[0];
  if (!draft.sent)
    return shell(
      <>
        {examBar}
        {composeGrid}
        <div className={`ocr-action-bar ${canSend ? "ready" : ""}`}>
          <div className="ocr-action-status">
            <strong>{canSend ? `Ready to send to ${firstName}` : sendHint}</strong>
          </div>
          <Button variant="secondary" onClick={() => onNavigate("Grading")}>
            Back to Grading
          </Button>
          <Button
            className={canSend ? "pulse" : ""}
            disabled={!canSend}
            onClick={() => onSend(item.id)}
          >
            Send to {firstName} <Icon name="arrow" />
          </Button>
        </div>
      </>,
    );

  // Sent: one calm status line, then either the practice answers or a read-only copy of what was sent.
  const tab = includePractice ? sentTab : "sent";
  return shell(
    <>
      {examBar}
      <div className="fb-sent-bar">
        <span className="fb-sent-status">
          <Icon name="check" size={15} />
          <b>Sent to {firstName}</b>
          {includePractice ? "Grade, message and practice" : "Grade and message"}
        </span>
        {false && (
          <div className="fb-tabs" role="tablist">
            <button
              role="tab"
              aria-selected={tab === "practice"}
              className={tab === "practice" ? "active" : ""}
              onClick={() => setSentTab("practice")}
            >
              Practice answers
              {practiceToCheck(item) && <em>{unmarked || teacherItems.length} to check</em>}
            </button>
            <button
              role="tab"
              aria-selected={tab === "sent"}
              className={tab === "sent" ? "active" : ""}
              onClick={() => setSentTab("sent")}
            >
              What you sent
            </button>
          </div>
        )}
        {nextStudent ? (
          <Button onClick={() => stages?.pick(nextStudent.examId)}>
            Next student: {nextStudent.studentName} <Icon name="arrow" />
          </Button>
        ) : (
          <Button variant="secondary" onClick={() => stages?.back()}>
            All done · Back to Grading <Icon name="arrow" />
          </Button>
        )}
      </div>
      {includePractice ? (
        reviewPanel
      ) : (
        <section className="fb-rv-empty">
          <span>
            <Icon name="check" size={22} />
          </span>
          <strong>Sent to {firstName}</strong>
          <p className="fb-sent-text">“{draft.message}”</p>
        </section>
      )}
    </>,
  );
}

// ============================================================
// Student profiles (teacher): one place to see a student's whole picture
// ============================================================

/** Opens a student's profile from any teacher screen (names become links). */
const OpenProfileContext = createContext<((studentId: string) => void) | null>(null);

function ProfileLink({ studentId, name }: { studentId: string; name: string }) {
  const open = useContext(OpenProfileContext);
  if (!open) return <strong>{name}</strong>;
  return (
    <button
      className="profile-link"
      title={`Open ${name}'s profile`}
      onClick={() => open(studentId)}
    >
      {name}
    </button>
  );
}

/** Class-wide quizzes Nadia gave before the current exam (same for every student in a grade). */
const pastQuizTitles: Record<string, string[]> = {
  "Grade 3": ["Addition and Subtraction Quiz", "Times Tables Check", "Shapes and Patterns"],
  "Grade 4": ["Multiplication Review", "Word Problems Check", "Fractions Test – Unit 3"],
};
const pastQuizDates = ["Apr 8", "Apr 28", "May 14"];

type ProfileExam = {
  id: string;
  title: string;
  subject: string;
  date: string;
  score?: number;
  status: string;
  tone: "done" | "open" | "wait";
};

type ProfileTodo = {
  id: string;
  icon: IconName;
  label: string;
  detail: string;
  action: string;
  go: () => void;
};

function TeacherStudents({
  baseStudents,
  studentList,
  flagStates,
  ocrTasks,
  gradeTasks,
  gaps,
  feedbackItems,
  threshold,
  selectedId,
  onSelect,
  scope,
  onScope,
  onOpenOcr,
  onOpenGrade,
  onOpenGap,
  onOpenFeedback,
  onOpenFlags,
  onNavigate,
  onLogout,
}: {
  /** Original class data (scores before this session's grading). */
  baseStudents: Student[];
  /** Live data: includes grades finalized in this session. */
  studentList: Student[];
  flagStates: FlagState[];
  ocrTasks: OCRTask[];
  gradeTasks: GradeTask[];
  gaps: LearningGap[];
  feedbackItems: FeedbackItem[];
  threshold: number;
  selectedId: string | null;
  onSelect: (studentId: string | null) => void;
  scope: Scope;
  onScope: (scope: Scope) => void;
  onOpenOcr: (taskId: string) => void;
  onOpenGrade: (taskId: string) => void;
  onOpenGap: (studentId: string) => void;
  onOpenFeedback: (itemId: string) => void;
  onOpenFlags: (studentId: string) => void;
  onNavigate: (label: string) => void;
  onLogout: () => void;
}) {
  const [tab, setTab] = useState<"overview" | "exams" | "gaps">("overview");
  useEffect(() => setTab("overview"), [selectedId]);

  // ---------- everything we know about one student ----------
  const profileOf = (student: Student) => {
    const first = student.name.split(" ")[0];
    const flag = flagStates.find((item) => item.student.id === student.id);
    const myOcr = ocrTasks.filter((task) => task.studentId === student.id);
    const myGrades = gradeTasks.filter((task) => task.studentId === student.id);
    const myGaps = gaps.filter((gap) => gap.studentId === student.id);
    const myFeedback = feedbackItems.filter((item) => item.studentId === student.id);
    const gradeFinal = (gap: LearningGap) =>
      Boolean(myGrades.find((task) => task.id === gap.gradeTaskId)?.finalized);

    const todos: ProfileTodo[] = [];
    myOcr
      .filter((task) => task.readiness === "ready" && !task.completed)
      .forEach((task) =>
        todos.push({
          id: `ocr-${task.id}`,
          icon: "scan",
          label: "Check the AI reading",
          detail: task.title,
          action: "Open OCR",
          go: () => onOpenOcr(task.id),
        }),
      );
    myGrades
      .filter((task) => task.ocrDone && !task.finalized)
      .forEach((task) =>
        todos.push({
          id: `grade-${task.id}`,
          icon: "grade",
          label: "Review the AI grades",
          detail: task.title,
          action: "Open Grade Review",
          go: () => onOpenGrade(task.id),
        }),
      );
    myGaps
      .filter((gap) => gap.status === "suggested" && gradeFinal(gap))
      .forEach((gap) =>
        todos.push({
          id: `gap-${gap.id}`,
          icon: "journey",
          label: "Decide on a suggested learning gap",
          detail: gap.title,
          action: "Open in Grading",
          go: () => onOpenGap(student.id),
        }),
      );
    myFeedback.forEach((item) => {
      if (item.gradeFinal && item.gap?.status !== "suggested" && !item.draft.sent)
        todos.push({
          id: `fb-${item.id}`,
          icon: "message",
          label: "Send feedback",
          detail: item.title,
          action: "Open Feedback",
          go: () => onOpenFeedback(item.id),
        });
      if (item.draft.sent && item.practice?.completed && !item.practice.reviewed)
        todos.push({
          id: `practice-${item.id}`,
          icon: "practice",
          label: "Check practice answers",
          detail: `${item.practice.savedForTeacher} open answer${item.practice.savedForTeacher === 1 ? "" : "s"} to mark`,
          action: "Open Feedback",
          go: () => onOpenFeedback(item.id),
        });
    });
    if (flag?.status === "suggested")
      todos.push({
        id: "flag",
        icon: "flag",
        label: "Decide on a suggested red flag",
        detail:
          flag.kind === "Declining"
            ? `Scores falling: ${flag.student.scores.join("% → ")}%`
            : `Latest score ${flag.student.latestScore}% is at or below ${threshold}%`,
        action: "Open Red Flags",
        go: () => onOpenFlags(student.id),
      });

    // Exams: earlier class quizzes, then this term's exams that are in the system.
    const base = baseStudents.find((item) => item.id === student.id) ?? student;
    const past: ProfileExam[] =
      student.id === "omar"
        ? Object.entries(omarSubjectHistory)
            .filter(([subject]) => subject === TEACHER_SUBJECT)
            .flatMap(([subject, list]) =>
              list.map((exam) => ({
                id: exam.examId,
                title: exam.title,
                subject,
                date: exam.date,
                score: exam.score,
                status: "Graded",
                tone: "done" as const,
              })),
            )
        : base.scores.map((score, index) => ({
            id: `${student.id}-past-${index}`,
            title: pastQuizTitles[student.grade]?.[index] ?? `Quiz ${index + 1}`,
            subject: "Mathematics",
            date: pastQuizDates[index] ?? "",
            score,
            status: "Graded",
            tone: "done" as const,
          }));
    // Oldest first, across subjects (dates are "Apr 8" style, all in the same school year).
    past.sort((x, y) => Date.parse(`${x.date} 2025`) - Date.parse(`${y.date} 2025`));
    const current: ProfileExam[] = [
      ...myGrades.map((task) => {
        const feedback = myFeedback.find((item) => item.id === task.id);
        return {
          id: task.id,
          title: task.title,
          subject: task.subject,
          date: task.submittedAt.replace(/, \d{4}$/, ""),
          score: task.finalized ? task.finalScore : undefined,
          status: !task.ocrDone
            ? "Waiting for OCR check"
            : !task.finalized
              ? "Waiting for grade review"
              : feedback?.draft.sent
                ? "Feedback sent"
                : "Graded · feedback not sent",
          tone: (!task.ocrDone || !task.finalized
            ? "open"
            : feedback?.draft.sent
              ? "done"
              : "open") as ProfileExam["tone"],
        };
      }),
      ...myOcr
        .filter((task) => !myGrades.some((grade) => grade.id === task.id))
        .map((task) => ({
          id: task.id,
          title: task.title,
          subject: task.subject,
          date: task.submittedAt.replace(/, \d{4}$/, ""),
          score: undefined,
          status: task.completed ? "Waiting for AI grading" : "Waiting for OCR check",
          tone: (task.readiness === "reading" || task.completed
            ? "wait"
            : "open") as ProfileExam["tone"],
        })),
    ];

    const subjects = [...new Set([...past, ...current].map((exam) => exam.subject))].map(
      (subject) => ({
        subject,
        exams: [...past, ...current].filter(
          (exam) => exam.subject === subject && exam.score !== undefined,
        ),
      }),
    );

    // What the student has received, and Nadia's private notes.
    const sent: { id: string; title: string; text: string; extra?: string }[] = [];
    const notes: { id: string; title: string; text: string }[] = [];
    myFeedback.forEach((item) => {
      if (!item.draft.sent) return;
      const practiceSent =
        item.gap?.status === "confirmed" && item.draft.sendPractice && item.draft.questions.length;
      sent.push({
        id: `fb-${item.id}`,
        title: `Feedback · ${item.title}`,
        text: item.draft.message,
        extra: `Grade ${item.finalScore}%${practiceSent ? ` · ${item.draft.questions.length} practice questions` : ""}`,
      });
      if (item.practice?.reviewed)
        sent.push({
          id: `practice-${item.id}`,
          title: "Practice result",
          text: `${item.practice.finalCorrect} of ${item.practice.total} right, checked by you.`,
          extra: item.practice.items
            .filter((record) => record.teacherComment)
            .map((record) => `“${record.teacherComment}”`)
            .join(" "),
        });
    });
    if (flag?.status === "confirmed" && flag.record?.studentNote)
      sent.push({ id: "flag-msg", title: "Message from you", text: flag.record.studentNote });
    myGaps.forEach((gap) => {
      if (gap.teacherObservation.trim())
        notes.push({
          id: `obs-${gap.id}`,
          title: `Classroom note · ${gap.topic}`,
          text: gap.teacherObservation,
        });
      if (gap.status === "dismissed" && gap.dismissReason)
        notes.push({
          id: `dis-${gap.id}`,
          title: `Why you dismissed “${gap.title}”`,
          text: gap.dismissReason,
        });
    });
    if (flag?.record?.observation)
      notes.push({
        id: "flag-note",
        title:
          flag.status === "dismissed"
            ? "Why you dismissed the red flag"
            : "Red flag · private reason",
        text: flag.record.observation,
      });

    return {
      first,
      flag,
      todos,
      past,
      current,
      subjects,
      myGaps,
      myFeedback,
      sent,
      notes,
      gradeFinal,
    };
  };

  const visibleStudents = studentList.filter((student) => inScope(scope, student.className));
  const navItems: NavItem[] = studentList.map((student) => {
    const info = profileOf(student);
    return {
      id: student.id,
      name: student.name,
      initials: student.initials,
      className: student.className,
      detail: `${student.latestScore}% latest score`,
      state: info.todos.length
        ? `${info.todos.length} to do`
        : info.flag?.status === "confirmed"
          ? "Flagged"
          : "Up to date",
      tone: info.todos.length ? "open" : info.flag?.status === "confirmed" ? "wait" : "done",
    };
  });
  const student = selectedId ? studentList.find((item) => item.id === selectedId) : undefined;

  const shell = (children: ReactNode) => (
    <PortalLayout role="teacher" active="Students" onNavigate={onNavigate} onLogout={onLogout}>
      <Topbar
        title={student ? student.name : "Students"}
        subtitle={
          student
            ? "Everything about this student in one place."
            : "Open a student to see their progress, learning gaps and what they have received."
        }
      />
      <div className="content teacher-workflow-content stp">
        <ClassNavigator
          scope={scope}
          onScope={(next) => {
            onScope(next);
            if (student && !inScope(next, student.className)) onSelect(null);
          }}
          items={navItems}
          selectedId={student?.id}
          onSelect={(id) => onSelect(id)}
          noun="students"
          listMode
        />
        {children}
      </div>
    </PortalLayout>
  );

  // ---------- list of students ----------
  if (!student)
    return shell(
      <section className="stp-grid">
        {visibleStudents.map((item) => {
          const info = profileOf(item);
          const gap = info.myGaps[0];
          return (
            <button key={item.id} className="stp-card" onClick={() => onSelect(item.id)}>
              <div className="stp-card-top">
                <span className="avatar avatar-navy">{item.initials}</span>
                <div>
                  <strong>{item.name}</strong>
                  <span>{shortClass(item.className)}</span>
                </div>
                <b className={item.latestScore <= threshold ? "low" : ""}>{item.latestScore}%</b>
              </div>
              <div className="stp-card-bars" aria-hidden="true">
                {item.scores.map((score, index) => (
                  <i key={index} style={{ height: `${Math.max(score, 8) * 0.34}px` }} />
                ))}
                <span className={`stp-trend ${item.trend}`}>
                  {item.trend === "down" ? "Falling" : item.trend === "up" ? "Rising" : "Steady"}
                </span>
              </div>
              <div className="stp-card-tags">
                {info.todos.length > 0 && <em className="todo">{info.todos.length} to do</em>}
                {info.flag?.status === "confirmed" && <em className="flag">Red flag</em>}
                {gap && gap.status !== "dismissed" && (
                  <em className={`gap ${gap.status}`}>
                    Gap: {gap.topic.toLowerCase()} ·{" "}
                    {gap.status === "confirmed" ? "confirmed" : "suggested"}
                  </em>
                )}
                {!info.todos.length && info.flag?.status !== "confirmed" && !gap && (
                  <em className="ok">Up to date</em>
                )}
              </div>
            </button>
          );
        })}
        {!visibleStudents.length && <p className="cn-empty">No students in {scopeLabel(scope)}.</p>}
      </section>,
    );

  // ---------- one student's profile ----------
  const info = profileOf(student);
  const { first, flag } = info;
  const confirmedGaps = info.myGaps.filter((gap) => gap.status === "confirmed").length;
  const gapStage = (gap: LearningGap) => {
    if (gap.status === "dismissed") return { text: "You dismissed this suggestion", tone: "muted" };
    if (gap.status === "suggested")
      return info.gradeFinal(gap)
        ? { text: "Waiting for your decision", tone: "open" }
        : { text: "Waiting for the grade to be finalized", tone: "muted" };
    const feedback = info.myFeedback.find((item) => item.id === gap.gradeTaskId);
    if (!feedback?.draft.sent) return { text: "Confirmed · feedback not sent yet", tone: "open" };
    if (!feedback.draft.sendPractice)
      return {
        text: "Confirmed · feedback sent · create practice from the Practice page",
        tone: "done",
      };
    if (!feedback.practice?.completed)
      return { text: `Practice sent · ${first} hasn’t done it yet`, tone: "wait" };
    if (!feedback.practice.reviewed)
      return { text: "Practice done · waiting for your check", tone: "open" };
    return {
      text: `Practice checked: ${feedback.practice.finalCorrect} of ${feedback.practice.total} right · watch the next quiz`,
      tone: "done",
    };
  };

  const subjectChart = (
    <section className="card stp-panel">
      <div className="stp-panel-head">
        <div className="section-title">{TEACHER_SUBJECT} progress</div>
        <span>Your graded exams, oldest first</span>
      </div>
      <div className="stp-subjects">
        {info.subjects.map(({ subject, exams: list }) => {
          const last = list[list.length - 1]?.score;
          const prev = list[list.length - 2]?.score;
          return (
            <div key={subject} className="stp-subject">
              <div className="stp-subject-head">
                <strong>{subject}</strong>
                {last !== undefined && (
                  <span
                    className={
                      prev !== undefined && last < prev
                        ? "down"
                        : prev !== undefined && last > prev
                          ? "up"
                          : ""
                    }
                  >
                    {last}%{prev !== undefined && last !== prev && (last > prev ? " ↑" : " ↓")}
                  </span>
                )}
              </div>
              <div className="stp-bars">
                {list.map((exam) => (
                  <div key={exam.id} title={`${exam.title} · ${exam.score}%`}>
                    <b>{exam.score}%</b>
                    <i>
                      <em
                        className={(exam.score ?? 0) <= threshold ? "low" : ""}
                        style={{ height: `${exam.score}%` }}
                      />
                    </i>
                    <span>{exam.date}</span>
                  </div>
                ))}
                {!list.length && <p className="cn-empty">No graded exams yet.</p>}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );

  const todoPanel = info.todos.length ? (
    <section className="stp-continue">
      <span className="stp-todo-icon">
        <Icon name="clock" size={16} />
      </span>
      <div>
        <strong>
          {info.todos.length === 1 ? "1 thing waiting" : `${info.todos.length} things waiting`}
        </strong>
        <span>{info.todos.map((todo) => todo.label).join(" · ")}</span>
      </div>
      <Button onClick={info.todos[0].go}>
        {info.todos[0].icon === "flag" ? "Decide on red flag" : "Continue review"}{" "}
        <Icon name="arrow" size={14} />
      </Button>
    </section>
  ) : (
    <p className="stp-clear">
      <Icon name="check" size={15} /> Nothing waiting for {first}. You are up to date.
    </p>
  );

  const gapList = (compact: boolean) =>
    info.myGaps.length ? (
      <div className="stp-gaps">
        {info.myGaps.map((gap) => {
          const stage = gapStage(gap);
          return (
            <article key={gap.id} className={`stp-gap ${gap.status}`}>
              <div className="stp-gap-head">
                <span className={`stp-chip ${gap.status}`}>
                  {gap.status === "confirmed"
                    ? "Confirmed by you"
                    : gap.status === "dismissed"
                      ? "Dismissed"
                      : gap.confidence >= 70
                        ? "AI suggestion · strong evidence"
                        : "AI suggestion · check carefully"}
                </span>
                <span className="stp-gap-topic">{gap.topic}</span>
              </div>
              <strong>{gap.title}</strong>
              {!compact && (
                <p className="stp-ai-text">
                  <span>
                    <Icon name="spark" size={11} /> AI suggestion
                  </span>
                  {gap.aiDescription}
                </p>
              )}
              <div className={`stp-stage ${stage.tone}`}>
                <Icon name="journey" size={13} /> {stage.text}
              </div>
              {!compact &&
                (gap.description.trim() !== gap.aiDescription.trim() ||
                  gap.teacherObservation.trim()) && (
                  <div className="stp-mynotes">
                    <b>
                      <Icon name="lock" size={12} /> My notes
                    </b>
                    {gap.description.trim() !== gap.aiDescription.trim() && (
                      <p>{gap.description}</p>
                    )}
                    {gap.teacherObservation.trim() && <p>{gap.teacherObservation}</p>}
                  </div>
                )}
            </article>
          );
        })}
      </div>
    ) : (
      <p className="stp-none">No learning gap has been suggested for {first}.</p>
    );

  const flagBox = (
    <div className={`stp-flag ${flag?.status ?? "none"}`}>
      <Icon name="flag" size={14} />
      <span>
        {flag?.status === "confirmed"
          ? `Red flag confirmed${flag.kind === "Manual" ? " (added by you)" : ""}`
          : flag?.status === "suggested"
            ? "Red flag suggested by AI · waiting for you"
            : flag?.status === "dismissed"
              ? "Red flag dismissed by you"
              : "No red flag"}
      </span>
    </div>
  );

  const examTable = (
    <section className="card stp-panel">
      <div className="stp-panel-head">
        <div className="section-title">Exams</div>
        <span>
          {info.past.length + info.current.length} exams · {info.current.length} new this week
        </span>
      </div>
      <div className="stp-table">
        <div className="stp-row head">
          <span>Exam</span>
          <span>Date</span>
          <span>Score</span>
          <span>Status</span>
        </div>
        {[...info.current, ...[...info.past].reverse()].map((exam) => (
          <div key={exam.id} className="stp-row">
            <strong>{exam.title}</strong>
            <span>{exam.date}</span>
            <b className={exam.score !== undefined && exam.score <= threshold ? "low" : ""}>
              {exam.score !== undefined ? `${exam.score}%` : "–"}
            </b>
            <span className={`cn-state ${exam.tone}`}>{exam.status}</span>
          </div>
        ))}
      </div>
    </section>
  );

  return shell(
    <div className="sw stp-profile">
      <section className="stp-head">
        <button
          className="stp-back"
          onClick={() => onSelect(null)}
          aria-label="Back to all students"
        >
          <Icon name="chevron" size={16} />
        </button>
        <span className="avatar avatar-navy stp-avatar">{student.initials}</span>
        <div className="stp-who">
          <strong>{student.name}</strong>
          <span>
            {student.className} · {info.past.length + info.current.length} exams in LearnLens
          </span>
        </div>
        <div className="stp-stats">
          <div>
            <span>Latest score</span>
            <b className={student.latestScore <= threshold ? "low" : ""}>{student.latestScore}%</b>
          </div>
          <div>
            <span>Trend</span>
            <b className={student.trend}>
              {student.trend === "down" ? "Falling" : student.trend === "up" ? "Rising" : "Steady"}
            </b>
          </div>
          <div>
            <span>Learning gaps</span>
            <b>
              {confirmedGaps
                ? `${confirmedGaps} confirmed`
                : info.myGaps.length
                  ? "1 suggested"
                  : "None"}
            </b>
          </div>
        </div>
      </section>

      <div className="stp-tabs" role="tablist">
        {(
          [
            ["overview", "Overview"],
            ["exams", "Exams"],
            ["gaps", "Learning gaps"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            className={tab === id ? "active" : ""}
            onClick={() => setTab(id)}
          >
            {label}
            {id === "overview" && info.todos.length > 0 && <em>{info.todos.length}</em>}
          </button>
        ))}
      </div>

      <div className="stp-body">
        {tab === "overview" && (
          <>
            {todoPanel}
            <div className="stp-two">
              {subjectChart}
              <section className="card stp-panel">
                <div className="stp-panel-head">
                  <div className="section-title">Support</div>
                </div>
                {flagBox}
                {gapList(true)}
              </section>
            </div>
          </>
        )}
        {tab === "exams" && examTable}
        {tab === "gaps" && (
          <section className="card stp-panel">
            <div className="stp-panel-head">
              <div className="section-title">Learning gaps</div>
              <span>The AI suggests, you decide.</span>
            </div>
            {gapList(false)}
          </section>
        )}
      </div>
    </div>,
  );
}

type ReviewStepKey = "reading" | "grades" | "feedback";
type ReviewStepInfo = {
  key: ReviewStepKey;
  done: boolean;
  reachable: boolean;
};
const reviewStepLabels: Record<ReviewStepKey, string> = {
  reading: "OCR Verification",
  grades: "Confirm Grades",
  feedback: "Feedback & Learning Gap",
};
type QueueEntry = {
  examId: string;
  studentId: string;
  studentName: string;
  initials: string;
  className: string;
  title: string;
  subject: string;
  language: "English" | "German";
  submittedAt: string;
  finalScore?: number;
  /** The step this exam is waiting at, or "done" when everything has been sent. */
  status: ReviewStepKey | "practice" | "done";
  /** The teacher has something to do on this exam right now. */
  actionRequired: boolean;
  /** At least one step is finished. */
  started: boolean;
  dueToday: boolean;
  progress: number;
};
type QueueFilter = "all" | "reading" | "grades" | "feedback" | "sent" | "due";
const queueFilters: [QueueFilter, string][] = [
  ["all", "All"],
  ["reading", "OCR check"],
  ["grades", "Confirm grades"],
  ["feedback", "Feedback & gap"],
  ["sent", "Sent"],
  ["due", "Due today"],
];
/** One rule for every place that filters the queue (queue chips, sidebar, "Next student"). */
const queueMatches = (item: QueueEntry, filter: QueueFilter) => {
  if (filter === "all") return true;
  if (filter === "sent") return item.status === "done";
  if (filter === "due") return item.dueToday && item.status !== "done";
  if (filter === "feedback") return item.status === "feedback" || item.status === "practice";
  return item.status === filter;
};
const ReviewStepsContext = createContext<{
  stepsFor: (examId: string) => ReviewStepInfo[];
  open: (examId: string, step: ReviewStepKey) => void;
  queue: QueueEntry[];
  pick: (examId: string) => void;
  filter: QueueFilter;
  setFilter: (filter: QueueFilter) => void;
  /** Back to the Grading list. */
  back: () => void;
} | null>(null);

const queueStatusLabel: Record<QueueEntry["status"], string> = {
  reading: "OCR to verify",
  grades: "Grades to confirm",
  feedback: "Feedback & gap",
  practice: "Practice to mark",
  done: "Sent to student",
};

/** Top bar on every grading stage: back to the list, and the next student waiting. */
function GradingQueue({ examId }: { examId?: string }) {
  const context = useContext(ReviewStepsContext);
  if (!context) return null;
  const next = context.queue.find((entry) => entry.actionRequired && entry.examId !== examId);
  const waiting = context.queue.filter((entry) => entry.actionRequired).length;
  return (
    <nav className="gq-bar" aria-label="Grading">
      <button className="gq-back" onClick={context.back}>
        <Icon name="chevron" size={15} /> All submitted exams
      </button>
      <span className="gq-bar-count">{waiting} waiting for you</span>
      {next && (
        <button className="gq-next" onClick={() => context.pick(next.examId)}>
          Next: {next.studentName} <Icon name="arrow" size={14} />
        </button>
      )}
    </nav>
  );
}

/** Student + exam header and the four-stage indicator, shared by every grading stage. */
function ReviewSteps({ examId, current }: { examId?: string; current: ReviewStepKey }) {
  const context = useContext(ReviewStepsContext);
  if (!context || !examId) return null;
  const steps = context.stepsFor(examId);
  const exam = context.queue.find((item) => item.examId === examId);
  const doneCount = steps.filter((step) => step.done).length;
  return (
    <section className="gw-top">
      {exam && (
        <div className="gw-exam">
          <span className="avatar avatar-navy">{exam.initials}</span>
          <div className="gw-exam-text">
            <ProfileLink studentId={exam.studentId} name={exam.studentName} />
            <span>
              {exam.className} · {exam.subject} – {exam.title} ·{" "}
              {exam.language === "German" ? "DE · German · " : ""}
              Submitted {exam.submittedAt.replace(/, \d{4}$/, "")}
            </span>
          </div>
          {exam.finalScore !== undefined && (
            <span className="gw-final">
              Final grade <b>{exam.finalScore}%</b>
            </span>
          )}
          <div className="gw-progress">
            <span>
              Exam progress <b>{Math.round((doneCount / steps.length) * 100)}%</b>
            </span>
            <i>
              <em style={{ width: `${(doneCount / steps.length) * 100}%` }} />
            </i>
          </div>
        </div>
      )}
      <nav className="rv-steps" aria-label="Grading stages">
        {steps.map((step, index) => {
          const isCurrent = step.key === current;
          const state = step.done ? "done" : isCurrent ? "current" : "todo";
          return (
            <Fragment key={step.key}>
              {index > 0 && <i className={step.done || isCurrent ? "on" : ""} />}
              <button
                className={`${state} ${isCurrent ? "viewing" : ""}`}
                disabled={isCurrent || !step.reachable}
                aria-current={isCurrent ? "step" : undefined}
                onClick={() => context.open(examId, step.key)}
              >
                <b>{step.done ? <Icon name="check" size={14} /> : index + 1}</b>
                <span>
                  <strong>{reviewStepLabels[step.key]}</strong>
                  <small>
                    {step.done
                      ? "Completed"
                      : isCurrent
                        ? "In progress"
                        : step.reachable
                          ? "Ready"
                          : "Not started"}
                  </small>
                </span>
              </button>
            </Fragment>
          );
        })}
      </nav>
    </section>
  );
}

/** "Continue" always goes to the same student's next review step. */
function ContinueStep({
  examId,
  from,
  name,
}: {
  examId: string;
  from: ReviewStepKey;
  name: string;
}) {
  const context = useContext(ReviewStepsContext);
  if (!context) return null;
  const order: ReviewStepKey[] = ["reading", "grades", "feedback"];
  const steps = context.stepsFor(examId);
  const next = order
    .slice(order.indexOf(from) + 1)
    .find((key) => steps.find((step) => step.key === key));
  if (!next) return null;
  return (
    <Button onClick={() => context.open(examId, next)}>
      Continue: {reviewStepLabels[next]} for {name} <Icon name="arrow" />
    </Button>
  );
}

function StatusBadge({ status }: { status: ExamStatus }) {
  const type = status === "Graded" ? "success" : "warning";
  return (
    <Badge type={type}>
      <span className="status-dot" />
      {status}
    </Badge>
  );
}

function Trend({ scores, flagged = false }: { scores: number[]; flagged?: boolean }) {
  const falling = scores[2] < scores[0];
  const trendClass = falling ? (flagged ? "trend-critical" : "trend-declining") : "trend-up";
  return (
    <div className={`trend ${trendClass}`}>
      <svg viewBox="0 0 60 22" aria-hidden="true">
        <polyline points={`2,${falling ? 4 : 18} 29,${falling ? 10 : 11} 58,${falling ? 18 : 4}`} />
      </svg>
      <span>{falling ? (flagged ? "Critical decline" : "Declining") : "Improving"}</span>
    </div>
  );
}

type ReviewItem = {
  id: string;
  examId: string;
  studentId: string;
  studentName: string;
  initials: string;
  className: string;
  title: string;
  date: string;
  step: ReviewStepKey | "practice";
};
const todoStepLabel: Record<ReviewItem["step"], string> = {
  ...reviewStepLabels,
  practice: "Practice to mark",
};

const stepFilter: Record<ReviewItem["step"], QueueFilter> = {
  reading: "reading",
  grades: "grades",
  feedback: "feedback",
  practice: "feedback",
};

/** T1 Home: "What needs me today?" Nothing else. */
function TeacherHome({
  queue,
  flagsToDecide,
  studentList,
  scope,
  onScope,
  onContinue,
  onOpenGrading,
  onNavigate,
  onLogout,
}: {
  onOpenGrading: (filter: QueueFilter) => void;
  queue: ReviewItem[];
  flagsToDecide: number;
  studentList: Student[];
  scope: Scope;
  onScope: (scope: Scope) => void;
  onContinue: (item: ReviewItem) => void;
  onNavigate: (label: string) => void;
  onLogout: () => void;
}) {
  const visible = queue.filter((item) => inScope(scope, item.className));
  const scopedStudents = studentList.filter((student) => inScope(scope, student.className));
  const average = scopedStudents.length
    ? Math.round(
        scopedStudents.reduce((sum, student) => sum + student.latestScore, 0) /
          scopedStudents.length,
      )
    : 0;
  const scopeValue =
    scope.className !== ALL
      ? `class:${scope.className}`
      : scope.grade !== ALL
        ? `grade:${scope.grade}`
        : "all";
  return (
    <PortalLayout role="teacher" active="Dashboard" onNavigate={onNavigate} onLogout={onLogout}>
      <Topbar title={`Good morning, ${teacher.name}`} subtitle="Here is what needs you today." />
      <div className="content teacher-content th">
        <div className="th-head">
          <label className="select-wrap th-scope">
            <Icon name="school" />
            <select
              aria-label="Class"
              value={scopeValue}
              onChange={(event) => {
                const [kind, value] = event.target.value.split(":");
                if (kind === "class")
                  onScope({ grade: classInfo(value)?.grade ?? ALL, className: value });
                else if (kind === "grade") onScope({ grade: value, className: ALL });
                else onScope({ grade: ALL, className: ALL });
              }}
            >
              <option value="all">All my classes</option>
              {gradeNames.map((grade) => (
                <optgroup key={grade} label={grade}>
                  <option value={`grade:${grade}`}>All of {grade}</option>
                  {teacher.classes
                    .filter((item) => item.grade === grade)
                    .map((item) => (
                      <option key={item.name} value={`class:${item.name}`}>
                        Class {item.short}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </label>
        </div>

        <div className="stats-grid th-stats">
          <button className="stat-card stat-card-action" onClick={() => onOpenGrading("all")}>
            <span className="stat-icon stat-amber">
              <Icon name="clock" />
            </span>
            <div>
              <span>Waiting for you</span>
              <strong>{visible.length}</strong>
              <small>Open Grading</small>
            </div>
            <Icon name="chevron" size={16} />
          </button>
          <button className="stat-card stat-card-action" onClick={() => onNavigate("Red Flags")}>
            <span className="stat-icon stat-red">
              <Icon name="flag" />
            </span>
            <div>
              <span>Red flags to decide</span>
              <strong>{flagsToDecide}</strong>
              <small>Open Red flags</small>
            </div>
            <Icon name="chevron" size={16} />
          </button>
          <div className="stat-card">
            <span className="stat-icon stat-green">
              <Icon name="check" />
            </span>
            <div>
              <span>Class average</span>
              <strong>{average}%</strong>
              <small>Latest Mathematics results</small>
            </div>
          </div>
        </div>

        <section className="card th-todo">
          <div className="th-todo-head">
            <div className="section-title" role="heading" aria-level={2}>
              To do
            </div>
            <span>Oldest first. Each exam opens at the step it is waiting at.</span>
          </div>
          {visible.length ? (
            <ul className="th-list">
              {visible.map((item) => (
                <li key={item.id}>
                  <span className="avatar avatar-table">{item.initials}</span>
                  <span className="th-who">
                    <ProfileLink studentId={item.studentId} name={item.studentName} />
                    <small>
                      {shortClass(item.className)} · {item.title}
                    </small>
                  </span>
                  <button
                    className={`th-step ${item.step}`}
                    onClick={() => onOpenGrading(stepFilter[item.step])}
                    title="Show everyone at this stage"
                  >
                    {todoStepLabel[item.step]}
                  </button>
                  <span className="th-date">{item.date.replace(/, \d{4}$/, "")}</span>
                  <Button onClick={() => onContinue(item)}>
                    Continue review <Icon name="arrow" />
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="th-empty">
              <Icon name="check" size={16} /> Nothing waiting in {scopeLabel(scope)}. You are all
              caught up.
            </p>
          )}
        </section>
      </div>
    </PortalLayout>
  );
}

type PracticeAssignment = {
  id: string;
  studentId: string;
  title: string;
  questions: { id: string; text: string; answer: string; fromAi: boolean }[];
  basedOnGap: boolean;
  createdAt: string;
};
/** What the builder edits: an assignment before it belongs to a student. */
type PracticeDraft = Pick<PracticeAssignment, "title" | "questions" | "basedOnGap">;

type GapFilter = "all" | "gap" | "none";
type GapsTab = "create" | "assigned";

/** Practice: create practice for any student, or manage practice already assigned. */
function TeacherGapsOverview({
  studentList,
  gaps,
  assignments,
  tab,
  onTab,
  highlightId,
  onCreate,
  onEdit,
  onRemove,
  onNavigate,
  onLogout,
}: {
  studentList: Student[];
  gaps: LearningGap[];
  assignments: PracticeAssignment[];
  tab: GapsTab;
  onTab: (tab: GapsTab) => void;
  highlightId: string | null;
  onCreate: (studentId: string) => void;
  onEdit: (assignmentId: string) => void;
  onRemove: (assignmentId: string) => void;
  onNavigate: (label: string) => void;
  onLogout: () => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<GapFilter>("all");
  const [classFilter, setClassFilter] = useState(ALL);
  const [removing, setRemoving] = useState<string | null>(null);
  const gapOf = (studentId: string) =>
    gaps.find((gap) => gap.studentId === studentId && gap.status !== "dismissed");
  const studentOf = (studentId: string) => studentList.find((entry) => entry.id === studentId);
  // Smart search: every word must appear somewhere in the row.
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const matches = (text: string) => words.every((word) => text.toLowerCase().includes(word));
  const inClass = (className?: string) => classFilter === ALL || className === classFilter;

  const rows = studentList
    .map((student) => ({ student, gap: gapOf(student.id) }))
    .sort(
      (x, y) =>
        Number(Boolean(y.gap)) - Number(Boolean(x.gap)) ||
        x.student.name.localeCompare(y.student.name),
    );
  const baseRows = rows.filter(
    ({ student, gap }) =>
      inClass(student.className) &&
      matches(
        [
          student.name,
          student.className,
          shortClass(student.className),
          gap ? `gap ${gap.topic} ${gap.title} ${gap.description}` : "no gap",
        ].join(" "),
      ),
  );
  const fits = (row: (typeof rows)[number], value: GapFilter) =>
    value === "gap" ? Boolean(row.gap) : value === "none" ? !row.gap : true;
  const shownRows = baseRows.filter((row) => fits(row, filter));

  const shownAssignments = assignments.filter((assignment) => {
    const student = studentOf(assignment.studentId);
    return (
      inClass(student?.className) &&
      matches(
        [
          student?.name,
          student?.className,
          student ? shortClass(student.className) : "",
          assignment.title,
          assignment.basedOnGap ? "learning gap" : "from scratch",
          ...assignment.questions.map((question) => question.text),
        ].join(" "),
      )
    );
  });
  const gapCount = rows.filter((row) => row.gap).length;

  return (
    <PortalLayout role="teacher" active="Practice" onNavigate={onNavigate} onLogout={onLogout}>
      <Topbar
        title="Practice"
        subtitle="Create practice for your students (built from their learning gaps when they have one), and manage what you assigned."
      />
      <div className="content teacher-content gl">
        <div className="gl-tabs" role="tablist" aria-label="Practice">
          <button
            role="tab"
            aria-selected={tab === "create"}
            className={tab === "create" ? "active" : ""}
            onClick={() => onTab("create")}
          >
            <span className="gl-tab-icon">
              <Icon name="plus" size={20} />
            </span>
            <span>
              <strong>Create practice</strong>
              <small>Pick a student · {gapCount} with a learning gap</small>
            </span>
          </button>
          <button
            role="tab"
            aria-selected={tab === "assigned"}
            className={tab === "assigned" ? "active" : ""}
            onClick={() => onTab("assigned")}
          >
            <span className="gl-tab-icon">
              <Icon name="practice" size={20} />
            </span>
            <span>
              <strong>Assigned practice</strong>
              <small>
                {assignments.length} {assignments.length === 1 ? "assignment" : "assignments"} ·
                edit or remove
              </small>
            </span>
            {assignments.length > 0 && <em>{assignments.length}</em>}
          </button>
        </div>

        <div className="gl-tools">
          <label className="gq-search gl-search">
            <Icon name="search" size={15} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={
                tab === "create"
                  ? "Search name, class or skill (e.g. “fractions 4-B”)…"
                  : "Search student, class or assignment title…"
              }
              aria-label="Search"
            />
            {query && (
              <button className="gl-clear" onClick={() => setQuery("")} aria-label="Clear search">
                <Icon name="plus" size={13} />
              </button>
            )}
          </label>
          <label className="select-wrap gl-class">
            <Icon name="school" />
            <select
              aria-label="Class"
              value={classFilter}
              onChange={(event) => setClassFilter(event.target.value)}
            >
              <option value={ALL}>All my classes</option>
              {teacher.classes.map((item) => (
                <option key={item.name} value={item.name}>
                  Class {item.short}
                </option>
              ))}
            </select>
          </label>
        </div>

        {tab === "create" ? (
          <>
            <div className="gq-filters gl-filters" role="tablist" aria-label="Filter students">
              {(
                [
                  ["all", "All students"],
                  ["gap", "With learning gap"],
                  ["none", "No gap"],
                ] as [GapFilter, string][]
              ).map(([id, label]) => (
                <button
                  key={id}
                  role="tab"
                  aria-selected={filter === id}
                  className={`${filter === id ? "active" : ""} ${id === "gap" ? "gap" : ""}`}
                  onClick={() => setFilter(id)}
                >
                  {label} <span>{baseRows.filter((row) => fits(row, id)).length}</span>
                </button>
              ))}
            </div>
            <section className="card gl-list">
              {shownRows.map(({ student, gap }) => (
                <div key={student.id} className={`gl-row ${gap ? "has-gap" : ""}`}>
                  <span className="avatar avatar-table">{student.initials}</span>
                  <span className="gl-who">
                    <ProfileLink studentId={student.id} name={student.name} />
                    <small>
                      Class {shortClass(student.className)} · latest {student.latestScore}%
                    </small>
                  </span>
                  <span className="gl-gap">
                    {gap ? (
                      <>
                        <em className="gl-gap-tag">
                          <Icon name="journey" size={12} /> {gap.topic}
                        </em>
                        <small>
                          {gap.title}
                          {gap.status === "suggested" ? " · AI suggestion, not confirmed yet" : ""}
                        </small>
                      </>
                    ) : (
                      <small className="gl-none">No learning gap so far</small>
                    )}
                  </span>
                  <span className="gl-action">
                    <Button
                      variant={gap ? "primary" : "secondary"}
                      onClick={() => onCreate(student.id)}
                    >
                      <Icon name="plus" size={15} />
                      Create practice assignment
                    </Button>
                  </span>
                </div>
              ))}
              {!shownRows.length && <p className="th-empty">No students match your search.</p>}
            </section>
          </>
        ) : (
          <section className="card gl-list gl-assigned-list">
            {shownAssignments.map((assignment) => {
              const student = studentOf(assignment.studentId);
              if (!student) return null;
              const firstName = student.name.split(" ")[0];
              return (
                <div
                  key={assignment.id}
                  className={`gl-row gl-arow ${assignment.id === highlightId ? "fresh" : ""}`}
                >
                  <span className="avatar avatar-table">{student.initials}</span>
                  <span className="gl-who">
                    <ProfileLink studentId={student.id} name={student.name} />
                    <small>Class {shortClass(student.className)}</small>
                  </span>
                  <span className="gl-gap">
                    <strong className="gl-atitle">{assignment.title}</strong>
                    <small>
                      {assignment.questions.length}{" "}
                      {assignment.questions.length === 1 ? "question" : "questions"} ·{" "}
                      {assignment.basedOnGap ? "Based on learning gap" : "Written from scratch"} ·
                      Assigned {assignment.createdAt}
                    </small>
                  </span>
                  <span className="gl-action">
                    {removing === assignment.id ? (
                      <span className="gl-confirm">
                        <span>Remove from {firstName}?</span>
                        <Button
                          className="gl-danger"
                          onClick={() => {
                            onRemove(assignment.id);
                            setRemoving(null);
                          }}
                        >
                          Remove
                        </Button>
                        <Button variant="ghost" onClick={() => setRemoving(null)}>
                          Keep
                        </Button>
                      </span>
                    ) : (
                      <>
                        <Button variant="secondary" onClick={() => onEdit(assignment.id)}>
                          <Icon name="practice" size={15} /> Edit
                        </Button>
                        <Button
                          variant="secondary"
                          className="gl-remove"
                          onClick={() => setRemoving(assignment.id)}
                        >
                          <Icon name="trash" size={15} /> Remove
                        </Button>
                      </>
                    )}
                  </span>
                </div>
              );
            })}
            {!assignments.length ? (
              <div className="gl-empty">
                <strong>No practice assigned yet</strong>
                <span>Create one for any student from the Create practice tab.</span>
                <Button onClick={() => onTab("create")}>
                  <Icon name="plus" size={15} /> Create practice
                </Button>
              </div>
            ) : (
              !shownAssignments.length && (
                <p className="th-empty">No assignments match your search.</p>
              )
            )}
          </section>
        )}
      </div>
    </PortalLayout>
  );
}

type GradingTab = "submitted" | "missing";

/** Grading: who sent an exam (start or continue grading) and who still has to upload one. */
function TeacherGradingList({
  studentList,
  tab,
  onTab,
  reminders,
  reuploads,
  onRemind,
  onNavigate,
  onLogout,
}: {
  studentList: Student[];
  tab: GradingTab;
  onTab: (tab: GradingTab) => void;
  reminders: Record<string, string>;
  /** Students asked to upload an exam again: student id → exam title. */
  reuploads: Record<string, string>;
  onRemind: (studentId: string, message: string) => void;
  onNavigate: (label: string) => void;
  onLogout: () => void;
}) {
  const context = useContext(ReviewStepsContext);
  const [query, setQuery] = useState("");
  const [classFilter, setClassFilter] = useState(ALL);
  const [composing, setComposing] = useState<{ studentId: string; text: string } | null>(null);
  if (!context) return null;
  const { queue, filter, setFilter, pick } = context;
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const matches = (text: string) => words.every((word) => text.toLowerCase().includes(word));
  const inClass = (className: string) => classFilter === ALL || className === classFilter;

  const baseExams = queue.filter(
    (entry) =>
      inClass(entry.className) &&
      matches(
        [
          entry.studentName,
          entry.className,
          shortClass(entry.className),
          entry.title,
          queueStatusLabel[entry.status],
          entry.dueToday ? "due today" : "",
        ].join(" "),
      ),
  );
  const shownExams = baseExams.filter((entry) => queueMatches(entry, filter));
  const submittedIds = new Set(queue.map((entry) => entry.studentId));
  const missing = studentList
    .filter((student) => !submittedIds.has(student.id))
    .sort(
      (x, y) =>
        Number(Boolean(reuploads[y.id])) - Number(Boolean(reuploads[x.id])) ||
        x.name.localeCompare(y.name),
    );
  const shownMissing = missing.filter(
    (student) =>
      inClass(student.className) &&
      matches(
        [
          student.name,
          student.className,
          shortClass(student.className),
          reminders[student.id] ? "reminder sent" : "",
        ].join(" "),
      ),
  );
  const waiting = queue.filter((entry) => entry.actionRequired).length;
  const presetReminder = (student: Student) =>
    `Hi ${student.name.split(" ")[0]}, please remember to upload your Mathematics exam on LearnLens so I can check it. Thank you! – Ms. Nadia`;
  const actionLabel = (entry: QueueEntry) =>
    entry.status === "done" ? "View grading" : entry.started ? "Continue grading" : "Start grading";

  return (
    <PortalLayout role="teacher" active="Grading" onNavigate={onNavigate} onLogout={onLogout}>
      <Topbar
        title="Grading"
        subtitle="Grade the exams students sent, and remind the students who have not uploaded yet."
      />
      <div className="content teacher-content gl">
        <div className="gl-tabs" role="tablist" aria-label="Grading">
          <button
            role="tab"
            aria-selected={tab === "submitted"}
            className={tab === "submitted" ? "active" : ""}
            onClick={() => onTab("submitted")}
          >
            <span className="gl-tab-icon">
              <Icon name="grade" size={20} />
            </span>
            <span>
              <strong>Submitted exams</strong>
              <small>
                {queue.length} uploaded · {waiting} waiting for you
              </small>
            </span>
            {waiting > 0 && <em className="purple">{waiting}</em>}
          </button>
          <button
            role="tab"
            aria-selected={tab === "missing"}
            className={tab === "missing" ? "active" : ""}
            onClick={() => onTab("missing")}
          >
            <span className="gl-tab-icon">
              <Icon name="clock" size={20} />
            </span>
            <span>
              <strong>Not submitted yet</strong>
              <small>
                {missing.length} {missing.length === 1 ? "student" : "students"} · send a reminder
              </small>
            </span>
            {missing.length > 0 && <em className="amber">{missing.length}</em>}
          </button>
        </div>

        <div className="gl-tools">
          <label className="gq-search gl-search">
            <Icon name="search" size={15} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={
                tab === "submitted"
                  ? "Search student, class or exam (e.g. “fractions 4-B”)…"
                  : "Search student or class…"
              }
              aria-label="Search"
            />
            {query && (
              <button className="gl-clear" onClick={() => setQuery("")} aria-label="Clear search">
                <Icon name="plus" size={13} />
              </button>
            )}
          </label>
          <label className="select-wrap gl-class">
            <Icon name="school" />
            <select
              aria-label="Class"
              value={classFilter}
              onChange={(event) => setClassFilter(event.target.value)}
            >
              <option value={ALL}>All my classes</option>
              {teacher.classes.map((item) => (
                <option key={item.name} value={item.name}>
                  Class {item.short}
                </option>
              ))}
            </select>
          </label>
        </div>

        {tab === "submitted" ? (
          <>
            <div className="gq-filters gl-filters" role="tablist" aria-label="Filter exams">
              {queueFilters.map(([id, label]) => (
                <button
                  key={id}
                  role="tab"
                  aria-selected={filter === id}
                  className={filter === id ? "active" : ""}
                  onClick={() => setFilter(id)}
                >
                  {label} <span>{baseExams.filter((entry) => queueMatches(entry, id)).length}</span>
                </button>
              ))}
            </div>
            <section className="card gl-list">
              {shownExams.map((entry) => (
                <div
                  key={entry.examId}
                  className={`gl-row gr-row ${entry.actionRequired ? "needs" : ""} ${entry.status}`}
                >
                  <span className="avatar avatar-table">{entry.initials}</span>
                  <span className="gl-who">
                    <ProfileLink studentId={entry.studentId} name={entry.studentName} />
                    <small>
                      Class {shortClass(entry.className)} · sent{" "}
                      {entry.submittedAt.replace(/, \d{4}$/, "")}
                    </small>
                  </span>
                  <span className="gl-gap">
                    <strong className="gl-atitle">{entry.title}</strong>
                    <span className="gq-chips">
                      <em className={`gq-status ${entry.status}`}>
                        {queueStatusLabel[entry.status]}
                      </em>
                      {entry.dueToday && entry.status !== "done" && (
                        <em className="gq-due">Due today</em>
                      )}
                      <i
                        className="gr-progress"
                        aria-label={`${Math.round(entry.progress * 100)}% done`}
                      >
                        <b style={{ width: `${entry.progress * 100}%` }} />
                      </i>
                    </span>
                  </span>
                  <span className="gl-action">
                    <Button
                      variant={entry.status === "done" ? "secondary" : "primary"}
                      onClick={() => pick(entry.examId)}
                    >
                      {actionLabel(entry)} <Icon name="arrow" size={15} />
                    </Button>
                  </span>
                </div>
              ))}
              {!shownExams.length && <p className="th-empty">No exams match.</p>}
            </section>
          </>
        ) : (
          <section className="card gl-list">
            {shownMissing.map((student) => {
              const first = student.name.split(" ")[0];
              const open = composing?.studentId === student.id;
              return (
                <div key={student.id} className={`gl-row gr-missing ${open ? "open" : ""}`}>
                  <span className="avatar avatar-table">{student.initials}</span>
                  <span className="gl-who">
                    <ProfileLink studentId={student.id} name={student.name} />
                    <small>Class {shortClass(student.className)}</small>
                  </span>
                  <span className="gl-gap">
                    {reuploads[student.id] && !reminders[student.id] ? (
                      <>
                        <em className="gr-reupload-tag">
                          <Icon name="camera" size={12} /> Asked to upload again
                        </em>
                        <small>{reuploads[student.id]} · grading cancelled today</small>
                      </>
                    ) : reminders[student.id] ? (
                      <em className="gl-assigned">
                        <Icon name="check" size={12} /> Reminder sent today
                      </em>
                    ) : (
                      <small className="gl-none">No exam uploaded yet</small>
                    )}
                  </span>
                  <span className="gl-action">
                    {!open && (
                      <Button
                        variant={reminders[student.id] ? "secondary" : "primary"}
                        onClick={() =>
                          setComposing({ studentId: student.id, text: presetReminder(student) })
                        }
                      >
                        <Icon name="message" size={15} />
                        {reminders[student.id] || reuploads[student.id]
                          ? "Remind again"
                          : "Send reminder"}
                      </Button>
                    )}
                  </span>
                  {open && composing && (
                    <div className="gr-compose">
                      <label>
                        <span>Message to {first}</span>
                        <textarea
                          autoFocus
                          value={composing.text}
                          onChange={(event) =>
                            setComposing({ ...composing, text: event.target.value })
                          }
                        />
                      </label>
                      <div className="gr-compose-actions">
                        <Button variant="ghost" onClick={() => setComposing(null)}>
                          Cancel
                        </Button>
                        <Button
                          disabled={!composing.text.trim()}
                          onClick={() => {
                            onRemind(student.id, composing.text.trim());
                            setComposing(null);
                          }}
                        >
                          Send to {first} <Icon name="arrow" size={15} />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {!missing.length ? (
              <p className="th-empty">
                <Icon name="check" size={16} /> Every student has uploaded an exam.
              </p>
            ) : (
              !shownMissing.length && <p className="th-empty">No students match your search.</p>
            )}
          </section>
        )}
      </div>
    </PortalLayout>
  );
}

/** Practice assignment builder: suggested questions for a learning gap, or a blank page. */
function TeacherPracticeBuilder({
  student,
  gap,
  suggested,
  existing,
  onAssign,
  onBack,
  onNavigate,
  onLogout,
}: {
  student: Student;
  gap?: LearningGap;
  suggested: PracticeQuestion[];
  existing?: PracticeDraft;
  onAssign: (assignment: PracticeDraft) => void;
  onBack: () => void;
  onNavigate: (label: string) => void;
  onLogout: () => void;
}) {
  const firstName = student.name.split(" ")[0];
  const blank = () => ({
    id: `q-${Date.now()}-${Math.random()}`,
    text: "",
    answer: "",
    fromAi: false,
  });
  const [title, setTitle] = useState(
    existing?.title ?? (gap ? `Practice: ${gap.topic}` : `Practice for ${firstName}`),
  );
  const [questions, setQuestions] = useState<PracticeAssignment["questions"]>(
    existing?.questions ??
      (gap && suggested.length
        ? suggested.map((question) => ({
            id: question.id,
            text: question.text,
            answer: question.answer,
            fromAi: true,
          }))
        : [blank()]),
  );
  const update = (id: string, changes: Partial<PracticeAssignment["questions"][number]>) =>
    setQuestions((current) =>
      current.map((question) =>
        question.id === id ? { ...question, ...changes, fromAi: false } : question,
      ),
    );
  const complete = questions.filter((question) => question.text.trim() && question.answer.trim());
  const half = questions.some(
    (question) => Boolean(question.text.trim()) !== Boolean(question.answer.trim()),
  );
  const canAssign = complete.length > 0 && !half && title.trim().length > 0;
  return (
    <PortalLayout role="teacher" active="Practice" onNavigate={onNavigate} onLogout={onLogout}>
      <Topbar
        title={existing ? "Edit practice assignment" : "Create practice assignment"}
        subtitle={`Questions and answers for ${student.name}. It goes to ${firstName}'s Practice page.`}
      />
      <div className="content teacher-content pb">
        <button className="text-button pb-back" onClick={onBack}>
          <Icon name="chevron" size={14} />{" "}
          {existing ? "Back to Assigned practice" : "Back to Create practice"}
        </button>
        <section className={`card pb-student ${gap ? "has-gap" : ""}`}>
          <span className="avatar avatar-navy">{student.initials}</span>
          <div>
            <ProfileLink studentId={student.id} name={student.name} />
            <span>Class {shortClass(student.className)} · Mathematics</span>
          </div>
          {gap ? (
            <div className="pb-gap">
              <Icon name="spark" size={15} />
              <span>
                <b>Learning gap: {gap.topic}</b>
                LearnLens suggested {suggested.length} questions for “{gap.title}”. Edit, remove or
                add your own.
              </span>
            </div>
          ) : (
            <div className="pb-gap none">
              <Icon name="practice" size={15} />
              <span>
                <b>No learning gap</b>
                Write your own questions and answers from scratch.
              </span>
            </div>
          )}
        </section>

        <section className="card pb-card">
          <label className="pb-title">
            <span>Assignment title</span>
            <input value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>
          <div className="pb-head">
            <span>#</span>
            <span>Question</span>
            <span>Correct answer</span>
            <span />
          </div>
          {questions.map((question, index) => (
            <div key={question.id} className={`pb-row ${question.fromAi ? "ai" : ""}`}>
              <span className="pb-num">{index + 1}</span>
              <input
                value={question.text}
                placeholder="Write a question…"
                aria-label={`Question ${index + 1}`}
                onChange={(event) => update(question.id, { text: event.target.value })}
              />
              <input
                value={question.answer}
                placeholder="Answer"
                aria-label={`Answer ${index + 1}`}
                onChange={(event) => update(question.id, { answer: event.target.value })}
              />
              <span className="pb-row-end">
                {question.fromAi && (
                  <em className="pb-ai" title="Suggested by LearnLens">
                    <Icon name="spark" size={11} /> AI
                  </em>
                )}
                <button
                  aria-label={`Remove question ${index + 1}`}
                  disabled={questions.length <= 1}
                  onClick={() =>
                    setQuestions((current) => current.filter((entry) => entry.id !== question.id))
                  }
                >
                  <Icon name="trash" size={14} />
                </button>
              </span>
            </div>
          ))}
          <button
            className="fb-add-question-button pb-add"
            onClick={() => setQuestions((current) => [...current, blank()])}
          >
            + Add question
          </button>
        </section>

        <div className={`ocr-action-bar pb-bar ${canAssign ? "ready" : ""}`}>
          <div className="ocr-action-status">
            <strong>
              {canAssign
                ? `${complete.length} ${complete.length === 1 ? "question" : "questions"} ready for ${firstName}`
                : half
                  ? "Every question needs an answer"
                  : "Add at least one question with its answer"}
            </strong>
          </div>
          <Button variant="secondary" onClick={onBack}>
            Cancel
          </Button>
          <Button
            disabled={!canAssign}
            onClick={() =>
              onAssign({
                title: title.trim(),
                questions: complete,
                basedOnGap: Boolean(gap),
              })
            }
          >
            {existing ? "Save changes" : `Assign to ${firstName}`} <Icon name="arrow" />
          </Button>
        </div>
      </div>
    </PortalLayout>
  );
}

function Placeholder({
  role,
  active,
  onNavigate,
  onLogout,
}: {
  role: Role;
  active: string;
  onNavigate: (label: string) => void;
  onLogout: () => void;
}) {
  return (
    <PortalLayout role={role} active={active} onNavigate={onNavigate} onLogout={onLogout}>
      <Topbar
        title={active}
        subtitle={
          role === "student"
            ? "This learning space is almost ready."
            : "This review workspace is almost ready."
        }
        student={role === "student"}
      />
      <div className="placeholder-wrap">
        <div className="placeholder-card">
          <div className={`placeholder-icon ${role}`}>
            <Icon name={role === "student" ? "spark" : "journey"} size={32} />
          </div>
          <Badge type={role === "student" ? "blue" : "ai"}>NEXT MILESTONE</Badge>
          <div className="placeholder-title" role="heading" aria-level={2}>
            Coming in the next phase
          </div>
          <p>
            We’re building this part of LearnLens with the same clear, human-centered experience.
          </p>
          <Button onClick={() => onNavigate(role === "student" ? "Home" : "Dashboard")}>
            <Icon name="arrow" /> Back to {role === "student" ? "home" : "dashboard"}
          </Button>
        </div>
      </div>
    </PortalLayout>
  );
}

export default function App() {
  const [view, setView] = useState<View>("login");
  const [role, setRole] = useState<Role>("student");
  const [active, setActive] = useState("Home");
  const [submission, setSubmission] = useState<ExamSubmission>(initialExamSubmission);
  const [submissions, setSubmissions] = useState<ExamSubmission[]>(initialStudentSubmissions);
  const [qualityPageIndex, setQualityPageIndex] = useState(0);
  const [confirmationId, setConfirmationId] = useState<string | null>(null);
  const [selectedResultId, setSelectedResultId] = useState<string | null>(null);
  const [readStudentNotificationIds, setReadStudentNotificationIds] = useState<string[]>([]);
  const [practiceResult, setPracticeResult] = useState<PracticeResult | null>(null);
  const [teacherWorkflow, setTeacherWorkflow] = useState<TeacherWorkflow>(initialTeacherWorkflow);
  const [teacherFlags, setTeacherFlags] = useState<TeacherFlag[]>(initialTeacherFlags);
  const [extraOcrTasks, setExtraOcrTasks] = useState<OCRTask[]>(
    initialExtraOcrTasks.filter(mySubject),
  );
  // Students start with the full menu (icons + text); each role remembers its own choice.
  const [collapsedByRole, setCollapsedByRole] = useState<Record<Role, boolean>>(() => {
    try {
      const saved = window.localStorage.getItem("learnlens-sidebar");
      if (saved) return { student: false, teacher: false, ...JSON.parse(saved) };
    } catch {
      // storage unavailable – fall back to defaults
    }
    return { student: false, teacher: false };
  });
  const sidebarState = {
    collapsed: collapsedByRole[role],
    toggle: () =>
      setCollapsedByRole((current) => {
        const next = { ...current, [role]: !current[role] };
        try {
          window.localStorage.setItem("learnlens-sidebar", JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      }),
  };
  const [selectedOcrId, setSelectedOcrId] = useState(initialTeacherWorkflow.exam.id);
  const [extraGradeTasks, setExtraGradeTasks] = useState<GradeTask[]>(
    initialExtraGradeTasks.filter(mySubject),
  );
  const [selectedGradeId, setSelectedGradeId] = useState(initialTeacherWorkflow.exam.id);
  const [extraGaps, setExtraGaps] = useState<LearningGap[]>(initialExtraGaps.filter(mySubject));
  const [selectedGapId, setSelectedGapId] = useState(initialTeacherWorkflow.gap.id);
  const [queueFilter, setQueueFilter] = useState<QueueFilter>("all");
  const [builderStudentId, setBuilderStudentId] = useState<string | null>(null);
  const [gradingTab, setGradingTab] = useState<GradingTab>("submitted");
  /** Exams the teacher stopped grading because the student must upload them again. */
  const [reuploadRequests, setReuploadRequests] = useState<
    Record<string, { studentId: string; title: string; message: string }>
  >({});
  /** Upload reminders the teacher sent (teacher side only in this prototype). */
  const [reminders, setReminders] = useState<Record<string, string>>({});
  /** Set when the builder edits an existing assignment; null when it creates a new one. */
  const [builderAssignmentId, setBuilderAssignmentId] = useState<string | null>(null);
  const [gapsTab, setGapsTab] = useState<GapsTab>("create");
  const [freshAssignmentId, setFreshAssignmentId] = useState<string | null>(null);
  /** Practice the teacher created on the Practice page (teacher side only in this prototype). */
  const [practiceAssignments, setPracticeAssignments] = useState<PracticeAssignment[]>([]);
  const [extraFeedback, setExtraFeedback] = useState<FeedbackTask[]>(
    // Feedback only for tests in my subject.
    initialExtraFeedback.filter((item) =>
      initialExtraGradeTasks.some((task) => task.id === item.id && mySubject(task)),
    ),
  );
  const [selectedFeedbackId, setSelectedFeedbackId] = useState(initialTeacherWorkflow.exam.id);
  // Grade → class scope shared by the dashboard and every teacher work screen.
  const [scope, setScope] = useState<Scope>({ grade: ALL, className: ALL });
  const [flagThreshold, setFlagThreshold] = useState(60);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [resultsSeen, setResultsSeen] = useState(false);
  /** Results of student-only practice sets (never sent to the teacher). */
  const [practiceRuns, setPracticeRuns] = useState<Record<string, PracticeResult>>({});
  const [practiceSetId, setPracticeSetId] = useState<string | null>(null);
  const warmUpResult = practiceRuns["math-warm-up"] ?? null;

  const enter = (nextRole: Role) => {
    setRole(nextRole);
    setActive(nextRole === "student" ? "Home" : "Dashboard");
    setView(nextRole === "student" ? "student-home" : "teacher-dashboard");
  };

  const navigate = (label: string) => {
    if (role === "teacher" && label === "Grading") {
      openGrading();
      return;
    }
    setActive(label);
    if (label === "Students") setProfileId(null);
    if (label === "Practice") setPracticeSetId(null);
    if (role === "student" && label === "Home") setView("student-home");
    else if (role === "student" && label === "Upload Exam") setView("student-upload");
    else if (role === "student" && label === "Results") {
      setSelectedResultId(null);
      setView("student-results");
    } else if (role === "student" && label === "Practice") {
      setView("student-practice");
    } else if (role === "student" && label === "Progress") {
      setView("student-progress");
    } else if (role === "teacher") {
      const teacherViews: Record<string, View> = {
        Dashboard: "teacher-dashboard",
        Students: "teacher-students",
        "OCR Verification": "teacher-ocr",
        "Grade Review": "teacher-grade",
        Practice: "teacher-gaps-overview",
        "Red Flags": "teacher-flags",
        Feedback: "teacher-feedback",
      };
      setView(teacherViews[label] ?? "teacher-dashboard");
    } else setView("placeholder");
  };

  const logout = () => setView("login");
  const newSubmissionExams: Exam[] = submissions
    .filter((exam) => exam.id.startsWith("omar-upload-") && mySubject(exam))
    .map((exam) => ({
      id: exam.id,
      studentId: exam.studentId,
      studentName: "Omar Tarek",
      title: exam.examName === "Custom exam name" ? exam.customExamName : exam.examName,
      subject: exam.subject,
      language: exam.language,
      date: exam.submittedAt ?? "May 19, 2025",
      status: exam.status,
      action: "OCR",
    }));
  const workflowQueueExam: Exam | null =
    teacherWorkflow.feedback.sent || teacherWorkflow.gradeFinalized
      ? null
      : {
          id: teacherWorkflow.exam.id,
          studentId: teacherWorkflow.exam.studentId,
          studentName: teacherWorkflow.exam.studentName,
          title: teacherWorkflow.exam.title,
          subject: teacherWorkflow.exam.subject,
          language: teacherWorkflow.exam.language,
          date: teacherWorkflow.exam.submittedAt,
          status: "Teacher checking",
          action: teacherWorkflow.ocrCompleted ? "Grade" : "OCR",
        };
  const practiceQueueExam: Exam[] =
    teacherWorkflow.feedback.sent && practiceResult?.completed && !practiceResult.reviewed
      ? [
          {
            id: `practice-${teacherWorkflow.exam.id}`,
            studentId: teacherWorkflow.exam.studentId,
            studentName: teacherWorkflow.exam.studentName,
            title: `Practice: ${teacherWorkflow.gap.topic}`,
            subject: teacherWorkflow.exam.subject,
            language: teacherWorkflow.exam.language,
            date: "May 20, 2025",
            status: "Teacher checking",
            action: "Practice",
          },
        ]
      : [];
  const teacherQueueExams = [
    ...(workflowQueueExam ? [workflowQueueExam] : []),
    ...newSubmissionExams,
    ...practiceQueueExam,
  ];
  const confirmedSubmission = submissions.find((exam) => exam.id === confirmationId);
  const workflowSubmission = submissions.find((exam) => exam.id === teacherWorkflow.exam.id);
  const visibleStudentSubmissions: ExamSubmission[] = workflowSubmission
    ? submissions
    : [
        {
          id: teacherWorkflow.exam.id,
          studentId: teacherWorkflow.exam.studentId,
          examName: teacherWorkflow.exam.title,
          customExamName: "",
          subject: teacherWorkflow.exam.subject,
          language: teacherWorkflow.exam.language,
          pages: Array.from({ length: teacherWorkflow.exam.pages }, (_, index) => ({
            id: `${teacherWorkflow.exam.id}-pending-page-${index + 1}`,
            name: `Page ${index + 1}`,
            quality: "clear" as const,
          })),
          status: "Teacher checking",
          submitted: true,
          submittedAt: teacherWorkflow.exam.submittedAt,
          reference: teacherWorkflow.exam.reference,
        },
        ...submissions,
      ];
  const confirmedOmarFlag = teacherFlags.find(
    (flag) => flag.studentId === "omar" && flag.status === "confirmed" && flag.studentNote,
  );
  const studentBadges = computeStudentBadges(teacherWorkflow, practiceResult, submissions);
  const practiceBadgeNotes = studentBadges
    .filter((badge) => badge.earned && (badge.id === "explorer" || badge.id === "sharp"))
    .map((badge) => ({
      id: `badge-${badge.id}`,
      title: `You earned a badge: ${badge.title} 🏅`,
      body: badge.description,
      time: "Just now",
      kind: "success" as const,
      destination: "Home" as const,
    }));
  const omarReupload = reuploadRequests[teacherWorkflow.exam.id];
  const studentNotificationSource: Omit<StudentNotification, "read">[] = [
    ...(omarReupload
      ? [
          {
            id: "reupload-omar",
            title: "Please upload your exam again 📸",
            body: `Ms. Nadia says: ${omarReupload.message}`,
            time: "Just now",
            kind: "message" as const,
            subject: "Mathematics",
            destination: "Home" as const,
          },
        ]
      : []),
    ...(practiceResult?.reviewed && practiceResult.savedForTeacher > 0
      ? [
          {
            id: "practice-checked",
            title: `Ms. Nadia checked your practice ⭐`,
            subject: "Mathematics",
            body: `You got ${practiceResult.finalCorrect} of ${practiceResult.total} right. Open it to read her comments.`,
            time: "Just now",
            kind: "message" as const,
            destination: "Practice" as const,
          },
        ]
      : []),
    ...practiceBadgeNotes,
    ...(teacherWorkflow.feedback.sent
      ? [
          {
            id: "unit-4-grade-ready",
            title: "Your Comparing Fractions Quiz is ready! 🎉",
            subject: "Mathematics",
            body: "Ms. Nadia checked your exam and left you a message.",
            time: "Just now",
            kind: "success" as const,
            destination: "Results" as const,
            examId: teacherWorkflow.exam.id,
          },
          ...(teacherWorkflow.feedback.sendPractice
            ? [
                {
                  id: "unit-4-practice-ready",
                  title: `Ms. Nadia picked ${teacherWorkflow.feedback.questions.length} practice questions for you`,
                  subject: "Mathematics",
                  body: `They’ll help you practise ${teacherWorkflow.gap.topic.toLowerCase()}.`,
                  time: "Just now",
                  kind: "practice" as const,
                  destination: "Practice" as const,
                },
              ]
            : []),
        ]
      : []),
    ...(confirmedOmarFlag?.studentNote
      ? [
          {
            id: "teacher-note-omar",
            title: "A message from Ms. Nadia",
            subject: "Mathematics",
            body: confirmedOmarFlag.studentNote,
            time: "Just now",
            kind: "message" as const,
          },
        ]
      : []),
    ...notifications.map((notification) => ({
      id: `older-${notification.id}`,
      title: notification.title,
      body: notification.body,
      time: notification.time,
      kind: notification.id === "n2" ? ("practice" as const) : ("success" as const),
      destination: notification.id === "n2" ? ("Practice" as const) : ("Results" as const),
      examId: notification.id === "n1" ? "omar-fractions-unit-3" : undefined,
      subject: "Mathematics",
    })),
    {
      id: "physics-magnets",
      title: "Your Magnets test is ready: 79% 🧲",
      body: "Mr. Hassan says: great work on the magnet experiment!",
      time: "3 days ago",
      kind: "success" as const,
      subject: "Physics",
      destination: "Progress" as const,
    },
  ];
  const studentNotifications: StudentNotification[] = studentNotificationSource.map(
    (notification) => ({
      ...notification,
      read: readStudentNotificationIds.includes(notification.id),
    }),
  );
  const openStudentNotification = (notification: StudentNotification) => {
    setReadStudentNotificationIds((current) =>
      current.includes(notification.id) ? current : [...current, notification.id],
    );
    if (notification.destination === "Results") {
      setActive("Results");
      setSelectedResultId(notification.examId ?? null);
      setView("student-results");
    } else if (notification.destination === "Practice") {
      setActive("Practice");
      setView("student-practice");
    } else if (notification.destination === "Home") {
      setActive("Home");
      setView("student-home");
    } else if (notification.destination === "Progress") {
      setActive("Progress");
      setView("student-progress");
    }
    if (notification.examId === teacherWorkflow.exam.id) setResultsSeen(true);
  };

  // ---------- OCR verification (T2) ----------
  const workflowOcrTask: OCRTask = {
    id: teacherWorkflow.exam.id,
    studentId: teacherWorkflow.exam.studentId,
    studentName: teacherWorkflow.exam.studentName,
    initials: "OT",
    className: teacherWorkflow.exam.className,
    title: teacherWorkflow.exam.title,
    subject: teacherWorkflow.exam.subject,
    language: teacherWorkflow.exam.language,
    submittedAt: teacherWorkflow.exam.submittedAt,
    pages: teacherWorkflow.exam.pages,
    reference: teacherWorkflow.exam.reference,
    readiness: "ready",
    answers: teacherWorkflow.ocrAnswers,
    completed: teacherWorkflow.ocrCompleted,
  };
  const ocrTasks = (
    teacherWorkflow.feedback.sent ? extraOcrTasks : [workflowOcrTask, ...extraOcrTasks]
  ).filter((task) => !reuploadRequests[task.id]);
  const ocrReadyCount = ocrTasks.filter(
    (task) => task.readiness === "ready" && !task.completed,
  ).length;

  const updateOcrAnswers = (taskId: string, update: (answers: OCRAnswer[]) => OCRAnswer[]) => {
    if (taskId === teacherWorkflow.exam.id) {
      setTeacherWorkflow((current) => ({ ...current, ocrAnswers: update(current.ocrAnswers) }));
    } else {
      setExtraOcrTasks((current) =>
        current.map((task) =>
          task.id === taskId ? { ...task, answers: update(task.answers) } : task,
        ),
      );
    }
  };

  const normalize = (text: string) => text.toLowerCase().replace(/\s+/g, "");

  const completeOcr = (taskId: string) => {
    // Each student moves on independently: after the reading is checked, their own grade review opens.
    setSelectedGradeId(taskId);
    setActive("Grade Review");
    setView("teacher-grade");
    if (taskId !== teacherWorkflow.exam.id) {
      const ocrTask = extraOcrTasks.find((task) => task.id === taskId);
      setExtraOcrTasks((current) =>
        current.map((task) => (task.id === taskId ? { ...task, completed: true } : task)),
      );
      if (!ocrTask) return;
      focusClass(ocrTask.className);
      // The AI suggests a score for every answer, from the text the teacher just checked.
      const questions: GradeQuestion[] = ocrTask.answers.map((answer) => {
        const key = ocrAnswerKey[answer.id] ?? { expected: answer.handwritten, accepted: [] };
        const read = normalize(answer.extractedText);
        const right = [key.expected, ...key.accepted].some((option) => {
          const target = normalize(option);
          return target.length > 0 && (read === target || read.startsWith(target));
        });
        const unreadable = answer.status === "unreadable";
        return {
          id: `${answer.id}-grade`,
          question: answer.question,
          studentAnswer: unreadable
            ? "Unreadable – grade this answer from the original paper."
            : answer.extractedText,
          expectedAnswer: key.expected,
          maxScore: 2,
          suggestedScore: unreadable ? 0 : right ? 2 : 0,
          rationale: unreadable
            ? "The reading was marked unreadable. Please grade this answer from the paper."
            : right
              ? "Matches the expected answer."
              : `“${answer.extractedText}” does not match the expected answer.`,
          ocrId: answer.id,
          ocrUnreadable: unreadable,
        };
      });
      const first = ocrTask.studentName.split(" ")[0];
      const message = `Well done, ${first}! You worked carefully on this quiz. Next time, check each answer once more before you hand it in.`;
      setExtraGradeTasks((current) =>
        current.some((task) => task.id === taskId)
          ? current
          : [
              ...current,
              {
                id: ocrTask.id,
                studentId: ocrTask.studentId,
                studentName: ocrTask.studentName,
                initials: ocrTask.initials,
                className: ocrTask.className,
                title: ocrTask.title,
                subject: ocrTask.subject,
                language: ocrTask.language,
                submittedAt: ocrTask.submittedAt,
                ocrDone: true,
                finalized: false,
                questions,
              },
            ],
      );
      setExtraFeedback((current) =>
        current.some((item) => item.id === taskId)
          ? current
          : [
              ...current,
              {
                id: ocrTask.id,
                studentId: ocrTask.studentId,
                message,
                aiMessage: message,
                aiMessageNoGap: message,
                sendPractice: false,
                practiceApproved: false,
                sent: false,
                questions: [],
              },
            ],
      );
      return;
    }
    // Omar's exam: the verified text becomes the input for AI grading (T3).
    setTeacherWorkflow((current) => {
      const gradeQuestions = current.gradeQuestions.map((question) => {
        const ocr = current.ocrAnswers.find((answer) => answer.id === question.ocrId);
        const original = initialTeacherWorkflow.gradeQuestions.find(
          (item) => item.id === question.id,
        );
        if (!ocr || !original) return question;
        const ocrUnreadable = ocr.status === "unreadable";
        const studentAnswer = ocrUnreadable
          ? "Unreadable – grade this answer from the original paper."
          : ocr.extractedText;
        const matchesPaper = normalize(ocr.extractedText) === normalize(ocr.handwritten);
        const suggestion =
          ocrUnreadable || matchesPaper
            ? { suggestedScore: original.suggestedScore, rationale: original.rationale }
            : {
                suggestedScore: 0,
                rationale: `Graded from the text as read (“${ocr.extractedText}”), which does not match the expected answer. If the reading is wrong, reopen OCR verification.`,
              };
        const changed = studentAnswer !== question.studentAnswer;
        return {
          ...question,
          ...suggestion,
          studentAnswer,
          ocrUnreadable,
          // A changed reading invalidates any earlier grading decision.
          ...(changed
            ? { decision: undefined, finalScore: undefined, teacherNote: undefined }
            : {}),
        };
      });
      const readingChanged = gradeQuestions.some(
        (question, index) => question.studentAnswer !== current.gradeQuestions[index].studentAnswer,
      );
      return {
        ...current,
        ocrCompleted: true,
        gradeQuestions,
        // A changed reading means the finalized grade must be reviewed again.
        ...(readingChanged ? { gradeFinalized: false, finalScore: undefined } : {}),
      };
    });
    setSelectedGradeId(teacherWorkflow.exam.id);
    setActive("Grade Review");
    setView("teacher-grade");
  };

  const reopenOcr = (taskId: string) => {
    if (taskId === teacherWorkflow.exam.id) {
      setTeacherWorkflow((current) => ({ ...current, ocrCompleted: false }));
    } else {
      setExtraOcrTasks((current) =>
        current.map((task) => (task.id === taskId ? { ...task, completed: false } : task)),
      );
    }
  };

  const openOcrTask = (taskId: string) => {
    setSelectedOcrId(taskId);
    const ocrTask = ocrTasks.find((task) => task.id === taskId);
    if (ocrTask) focusClass(ocrTask.className);
    setActive("OCR Verification");
    setView("teacher-ocr");
  };

  // ---------- Grade review (T3) ----------
  const workflowGradeTask: GradeTask = {
    id: teacherWorkflow.exam.id,
    studentId: teacherWorkflow.exam.studentId,
    studentName: teacherWorkflow.exam.studentName,
    initials: "OT",
    className: teacherWorkflow.exam.className,
    title: teacherWorkflow.exam.title,
    subject: teacherWorkflow.exam.subject,
    language: teacherWorkflow.exam.language,
    submittedAt: teacherWorkflow.exam.submittedAt,
    ocrDone: teacherWorkflow.ocrCompleted,
    questions: teacherWorkflow.gradeQuestions,
    finalized: teacherWorkflow.gradeFinalized,
    finalScore: teacherWorkflow.finalScore,
  };
  const gradeTasks = [workflowGradeTask, ...extraGradeTasks];
  const gradeReadyCount = gradeTasks.filter((task) => task.ocrDone && !task.finalized).length;

  const updateGradeQuestions = (
    taskId: string,
    update: (questions: GradeQuestion[]) => GradeQuestion[],
  ) => {
    if (taskId === teacherWorkflow.exam.id) {
      setTeacherWorkflow((current) => ({
        ...current,
        gradeQuestions: update(current.gradeQuestions),
      }));
    } else {
      setExtraGradeTasks((current) =>
        current.map((task) =>
          task.id === taskId ? { ...task, questions: update(task.questions) } : task,
        ),
      );
    }
  };

  const finalizeGrade = (taskId: string, finalScore: number) => {
    // Then the same student's last stage: Feedback & Learning Gap.
    if (taskId === teacherWorkflow.exam.id) {
      setTeacherWorkflow((current) => ({ ...current, gradeFinalized: true, finalScore }));
      setSelectedGapId(teacherWorkflow.gap.id);
    } else {
      setExtraGradeTasks((current) =>
        current.map((task) =>
          task.id === taskId ? { ...task, finalized: true, finalScore } : task,
        ),
      );
    }
    setSelectedFeedbackId(taskId);
    setActive("Feedback");
    setView("teacher-feedback");
  };

  const reopenGrade = (taskId: string) => {
    if (taskId === teacherWorkflow.exam.id) {
      // Once feedback is sent the grade is released to the student and stays locked.
      if (teacherWorkflow.feedback.sent) return;
      setTeacherWorkflow((current) => ({ ...current, gradeFinalized: false }));
    } else {
      setExtraGradeTasks((current) =>
        current.map((task) => (task.id === taskId ? { ...task, finalized: false } : task)),
      );
    }
  };

  const openGradeTask = (taskId: string) => {
    setSelectedGradeId(taskId);
    const gradeTask = gradeTasks.find((task) => task.id === taskId);
    if (gradeTask) focusClass(gradeTask.className);
    setActive("Grade Review");
    setView("teacher-grade");
  };

  /** Make sure the chosen class contains this item, so selecting never hides it. */
  const focusClass = (className: string) => {
    if (!inScope(scope, className))
      setScope({ grade: classInfo(className)?.grade ?? ALL, className });
  };
  const selectIn =
    <T extends { id: string; className: string }>(list: T[], setter: (id: string) => void) =>
    (id: string) => {
      setter(id);
      const item = list.find((entry) => entry.id === id);
      if (item) focusClass(item.className);
    };

  // ---------- Learning gaps (T4) ----------
  const gaps = [teacherWorkflow.gap, ...extraGaps];
  const gapReadyCount = gaps.filter(
    (gap) =>
      gap.status === "suggested" &&
      gradeTasks.find((task) => task.id === gap.gradeTaskId)?.finalized,
  ).length;

  const updateGap = (id: string, changes: Partial<LearningGap>) => {
    if (id === teacherWorkflow.gap.id) {
      setTeacherWorkflow((current) => ({ ...current, gap: { ...current.gap, ...changes } }));
    } else {
      setExtraGaps((current) =>
        current.map((gap) => (gap.id === id ? { ...gap, ...changes } : gap)),
      );
    }
  };

  /** A student's learning gap is decided in stage 3 (Feedback & Learning Gap) of that exam. */
  const openStudentGap = (studentId: string) => {
    const gap = gaps.find((item) => item.studentId === studentId);
    if (gap) {
      setSelectedGapId(gap.id);
      openFeedbackItem(gap.gradeTaskId);
      return;
    }
    setActive("Practice");
    setView("teacher-gaps-overview");
  };

  const openProfile = (studentId: string) => {
    setProfileId(studentId);
    const student = students.find((item) => item.id === studentId);
    if (student) focusClass(student.className);
    setActive("Students");
    setView("teacher-students");
  };
  const openFeedbackItem = (itemId: string) => {
    setSelectedFeedbackId(itemId);
    const item = gradeTasks.find((task) => task.id === itemId);
    if (item) focusClass(item.className);
    setActive("Feedback");
    setView("teacher-feedback");
  };
  const openFlagsFor = (studentId: string) => {
    const student = students.find((item) => item.id === studentId);
    if (student) focusClass(student.className);
    setActive("Red Flags");
    setView("teacher-flags");
  };

  // ---------- Live student scores (finalized grades update the class data) ----------
  const liveStudents: Student[] = students.map((student) => {
    const finalTask = gradeTasks.find(
      (task) => task.studentId === student.id && task.finalized && task.finalScore !== undefined,
    );
    if (!finalTask || finalTask.finalScore === undefined) return student;
    const scores = [...student.scores.slice(1), finalTask.finalScore];
    return {
      ...student,
      latestScore: finalTask.finalScore,
      scores,
      status: "Graded" as const,
      trend:
        scores[2] < scores[0]
          ? ("down" as const)
          : scores[2] > scores[0]
            ? ("up" as const)
            : ("steady" as const),
    };
  });

  // ---------- Red flags (T5): AI suggestions + teacher decisions ----------
  const flagStates: FlagState[] = liveStudents.map((student) => {
    const record = teacherFlags.find((flag) => flag.studentId === student.id);
    const automatic = student.latestScore <= flagThreshold;
    const [a, b, c] = student.scores;
    const declining = student.scores.length >= 3 && a > b && b > c;
    const kind = automatic ? "Automatic" : declining ? "Declining" : record ? "Manual" : null;
    return {
      student,
      record,
      kind,
      status: record
        ? record.status === "pending"
          ? "suggested"
          : record.status
        : kind
          ? "suggested"
          : null,
    };
  });
  const flagReadyCount = flagStates.filter((item) => item.status === "suggested").length;

  const decideFlag = (studentId: string, record: TeacherFlag | null) =>
    setTeacherFlags((current) => [
      ...current.filter((flag) => flag.studentId !== studentId),
      ...(record ? [record] : []),
    ]);

  // ---------- Feedback (T6): one per exam ----------
  const feedbackItems: FeedbackItem[] = gradeTasks.map((task) => {
    const isMain = task.id === teacherWorkflow.exam.id;
    const gap = gaps.find((item) => item.gradeTaskId === task.id);
    const draft: FeedbackDraft = isMain
      ? teacherWorkflow.feedback
      : (extraFeedback.find((item) => item.id === task.id) ?? {
          message: "",
          aiMessage: "",
          aiMessageNoGap: "",
          sendPractice: false,
          practiceApproved: false,
          sent: false,
          questions: [],
        });
    return {
      id: task.id,
      studentId: task.studentId,
      studentName: task.studentName,
      initials: task.initials,
      className: task.className,
      title: task.title,
      subject: task.subject,
      gradeFinal: task.finalized,
      finalScore: task.finalScore,
      gap: gap ? { status: gap.status, title: gap.title, topic: gap.topic } : undefined,
      draft,
      practice: isMain ? practiceResult : undefined,
    };
  });
  const practiceToReview = Boolean(
    teacherWorkflow.feedback.sent && practiceResult?.completed && !practiceResult.reviewed,
  );
  const feedbackReadyCount =
    feedbackItems.filter(
      (item) => item.gradeFinal && item.gap?.status !== "suggested" && !item.draft.sent,
    ).length + (practiceToReview ? 1 : 0);

  // ---------- One to-do list, used by Home, the sidebar and student profiles ----------
  const examDate = (examId: string) =>
    gradeTasks.find((task) => task.id === examId)?.submittedAt ??
    ocrTasks.find((task) => task.id === examId)?.submittedAt ??
    "May 19, 2025";
  const reviewQueue: ReviewItem[] = [
    ...ocrTasks
      .filter((task) => task.readiness === "ready" && !task.completed)
      .map((task) => ({
        id: `reading-${task.id}`,
        examId: task.id,
        studentId: task.studentId,
        studentName: task.studentName,
        initials: task.initials,
        className: task.className,
        title: task.title,
        date: task.submittedAt,
        step: "reading" as const,
      })),
    ...gradeTasks
      .filter((task) => task.ocrDone && !task.finalized)
      .map((task) => ({
        id: `grades-${task.id}`,
        examId: task.id,
        studentId: task.studentId,
        studentName: task.studentName,
        initials: task.initials,
        className: task.className,
        title: task.title,
        date: task.submittedAt,
        step: "grades" as const,
      })),
    ...feedbackItems
      .filter((item) => item.gradeFinal && !item.draft.sent)
      .map((item) => ({
        id: `after-${item.id}`,
        examId: item.id,
        studentId: item.studentId,
        studentName: item.studentName,
        initials: item.initials,
        className: item.className,
        title: item.title,
        date: examDate(item.id),
        step: "feedback" as const,
      })),
    ...feedbackItems
      .filter((item) => item.draft.sent && item.practice?.completed && !item.practice.reviewed)
      .map((item) => ({
        id: `practice-${item.id}`,
        examId: item.id,
        studentId: item.studentId,
        studentName: item.studentName,
        initials: item.initials,
        className: item.className,
        title: item.title,
        date: "Today",
        step: "practice" as const,
      })),
  ].sort((x, y) => {
    const time = (value: string) => (value === "Today" ? Infinity : new Date(value).getTime());
    return time(x.date) - time(y.date);
  });
  const continueReview = (item: ReviewItem) => {
    if (item.step === "reading") openOcrTask(item.examId);
    else if (item.step === "grades") openGradeTask(item.examId);
    else openFeedbackItem(item.examId);
  };
  const reviewStepsFor = (examId: string): ReviewStepInfo[] => {
    const task = gradeTasks.find((entry) => entry.id === examId);
    const ocr = ocrTasks.find((entry) => entry.id === examId);
    const feedback = feedbackItems.find((entry) => entry.id === examId);
    const done = [
      task ? task.ocrDone : Boolean(ocr?.completed),
      Boolean(task?.finalized),
      Boolean(feedback?.draft.sent),
    ];
    const firstOpen = done.findIndex((value) => !value);
    const canOpen = [Boolean(ocr), Boolean(task), Boolean(feedback)];
    return (["reading", "grades", "feedback"] as const).map((key, index) => ({
      key,
      done: done[index],
      reachable: canOpen[index] && (done[index] || index === firstOpen),
    }));
  };
  /** Demo "today" is the newest submission date; exams are due five days after they arrive. */
  const demoToday = new Date("May 19, 2025").getTime();
  const examIds = Array.from(
    new Set([...ocrTasks.map((task) => task.id), ...gradeTasks.map((task) => task.id)]),
  ).filter((examId) => !reuploadRequests[examId]);
  const gradingQueue: QueueEntry[] = examIds
    .map((examId) => {
      const task = gradeTasks.find((entry) => entry.id === examId);
      const ocr = ocrTasks.find((entry) => entry.id === examId);
      const source = task ?? ocr!;
      const steps = reviewStepsFor(examId);
      const waiting = reviewQueue.find((item) => item.examId === examId);
      const firstOpen = steps.find((step) => !step.done);
      const status: QueueEntry["status"] = waiting
        ? waiting.step
        : firstOpen
          ? firstOpen.key
          : "done";
      return {
        examId,
        studentId: source.studentId,
        studentName: source.studentName,
        initials: source.initials,
        className: source.className,
        title: source.title,
        subject: source.subject,
        language: source.language,
        submittedAt: source.submittedAt,
        finalScore: task?.finalized ? task.finalScore : undefined,
        status,
        actionRequired: Boolean(waiting),
        started:
          steps.some((step) => step.done) ||
          Boolean(task?.questions.some((question) => question.decision)) ||
          Boolean(ocr?.answers.some((answer) => answer.status !== "pending")),
        dueToday: (demoToday - new Date(source.submittedAt).getTime()) / 86400000 >= 5,
        progress: steps.filter((step) => step.done).length / steps.length,
      };
    })
    .sort((x, y) => Number(y.actionRequired) - Number(x.actionRequired));
  const pickExam = (examId: string) => {
    const entry = gradingQueue.find((item) => item.examId === examId);
    if (!entry) return;
    const steps = reviewStepsFor(examId);
    const step: ReviewStepKey =
      entry.status === "done" || entry.status === "practice"
        ? "feedback"
        : steps.find((item) => item.key === entry.status)?.reachable
          ? entry.status
          : (steps.filter((item) => item.reachable).pop()?.key ?? "feedback");
    openReviewStep(examId, step);
  };
  /** The one way into the grading workspace: first student waiting in the chosen filter. */
  /** The one way into grading: the Grading list, optionally filtered to one stage. */
  const openGrading = (filter?: QueueFilter) => {
    if (filter) setQueueFilter(filter);
    setGradingTab("submitted");
    setActive("Grading");
    setView("teacher-grading-list");
  };
  const openReviewStep = (examId: string, step: ReviewStepKey) => {
    if (step === "reading") openOcrTask(examId);
    else if (step === "grades") openGradeTask(examId);
    else if (step === "feedback") openFeedbackItem(examId);
  };

  const reviewPractice = (_id: string, marks: ReviewMarks) =>
    setPracticeResult((current) => {
      if (!current) return current;
      const items = current.items.map((record) =>
        record.check === "teacher"
          ? {
              ...record,
              teacherMark: marks[record.questionId]?.mark,
              teacherComment: marks[record.questionId]?.comment?.trim() || undefined,
            }
          : record,
      );
      const finalCorrect = items.filter((record) =>
        record.check === "auto" ? record.correct : record.teacherMark === "correct",
      ).length;
      return { ...current, items, reviewed: true, finalCorrect };
    });

  const updateFeedback = (id: string, changes: Partial<FeedbackDraft>) => {
    if (id === teacherWorkflow.exam.id) {
      setTeacherWorkflow((current) => ({
        ...current,
        feedback: { ...current.feedback, ...changes },
      }));
    } else {
      setExtraFeedback((current) =>
        current.map((item) => (item.id === id ? { ...item, ...changes } : item)),
      );
    }
  };

  const sendFeedback = (id: string) => {
    const item = feedbackItems.find((entry) => entry.id === id);
    if (!item || item.finalScore === undefined) return;
    // Practice is assigned separately from the Practice page.
    updateFeedback(id, { sent: true, sendPractice: false });
    if (id !== teacherWorkflow.exam.id) return;
    // Omar's exam: release the grade and feedback to the student portal.
    const finalScore = item.finalScore;
    setSubmissions((current) => {
      const releasedExam: ExamSubmission = {
        id: teacherWorkflow.exam.id,
        studentId: teacherWorkflow.exam.studentId,
        examName: teacherWorkflow.exam.title,
        customExamName: "",
        subject: teacherWorkflow.exam.subject,
        language: teacherWorkflow.exam.language,
        pages: Array.from({ length: teacherWorkflow.exam.pages }, (_, index) => ({
          id: `${teacherWorkflow.exam.id}-page-${index + 1}`,
          name: `Page ${index + 1}`,
          quality: "clear" as const,
        })),
        status: "Graded",
        submitted: true,
        submittedAt: teacherWorkflow.exam.submittedAt,
        reference: teacherWorkflow.exam.reference,
        grade: finalScore,
      };
      const exists = current.some((exam) => exam.id === releasedExam.id);
      return exists
        ? current.map((exam) => (exam.id === releasedExam.id ? releasedExam : exam))
        : [releasedExam, ...current];
    });
  };

  // Dashboard queue reflects verification progress.
  const examUpdates: Record<string, Partial<Exam> | null> = {};
  extraOcrTasks.forEach((task) => {
    if (task.completed) examUpdates[task.id] = null;
  });
  extraGradeTasks.forEach((task) => {
    if (task.finalized) examUpdates[task.id] = null;
  });

  const renderScreen = (): ReactNode => {
    if (view === "login") return <Login onEnter={enter} />;
    if (view === "student-home")
      return (
        <StudentHome
          onNavigate={navigate}
          onLogout={logout}
          studentNotifications={studentNotifications}
          onOpenStudentNotification={openStudentNotification}
          practiceResult={practiceResult}
          badges={studentBadges}
          workflow={teacherWorkflow}
          submissions={visibleStudentSubmissions}
          resultsSeen={resultsSeen}
          warmUpDone={Boolean(warmUpResult?.completed)}
        />
      );
    if (view === "student-upload")
      return (
        <StudentUpload
          submission={submission}
          setSubmission={setSubmission}
          onReview={(pageIndex = 0) => {
            setQualityPageIndex(pageIndex);
            setView("student-quality");
          }}
          onNavigate={navigate}
          onLogout={logout}
        />
      );
    if (view === "student-quality")
      return (
        <StudentQualityCheck
          submission={submission}
          setSubmission={setSubmission}
          onBack={() => setView("student-upload")}
          onSubmit={() => {
            const id = `omar-upload-${Date.now()}`;
            const submittedExam: ExamSubmission = {
              ...submission,
              id,
              studentId: "omar",
              examName:
                submission.examName === "Custom exam name"
                  ? submission.customExamName
                  : submission.examName,
              submitted: true,
              submittedAt: "May 19, 2025",
              reference: `LL-OM-250519-${String(submissions.length + 1).padStart(3, "0")}`,
              status: "Teacher checking",
            };
            setSubmissions((current) => [submittedExam, ...current]);
            setConfirmationId(id);
            setSubmission({
              ...initialExamSubmission,
              reference: `LL-OM-DRAFT-${Date.now()}`,
            });
            setView("student-confirmation");
          }}
          onNavigate={navigate}
          onLogout={logout}
          initialPageIndex={qualityPageIndex}
        />
      );
    if (view === "student-confirmation" && confirmedSubmission)
      return (
        <SubmissionConfirmation
          submission={confirmedSubmission}
          onTrack={() => {
            setActive("Results");
            setSelectedResultId(null);
            setView("student-results");
          }}
          onHome={() => {
            setActive("Home");
            setView("student-home");
          }}
          onNavigate={navigate}
          onLogout={logout}
        />
      );
    if (view === "student-results")
      return (
        <ResultsHub
          submissions={[...visibleStudentSubmissions, ...otherSubjectResults]}
          selectedId={selectedResultId}
          teacherWorkflow={teacherWorkflow}
          onStartPractice={() => {
            setActive("Practice");
            setView("student-practice");
          }}
          onSelect={(id) => {
            setSelectedResultId(id);
            if (id === teacherWorkflow.exam.id && teacherWorkflow.feedback.sent)
              setResultsSeen(true);
          }}
          onUpdateStatus={(id, status) =>
            setSubmissions((current) =>
              current.map((exam) => (exam.id === id ? { ...exam, status } : exam)),
            )
          }
          onNavigate={navigate}
          onLogout={logout}
        />
      );
    if (view === "student-practice")
      return (
        <StudentPractice
          workflow={teacherWorkflow}
          practiceResult={practiceResult}
          onComplete={setPracticeResult}
          runs={practiceRuns}
          onRunComplete={(id, result) =>
            setPracticeRuns((current) => ({ ...current, [id]: result }))
          }
          setId={practiceSetId}
          onSetId={setPracticeSetId}
          onNavigate={navigate}
          onLogout={logout}
        />
      );
    if (view === "student-progress")
      return (
        <StudentProgress
          workflow={teacherWorkflow}
          practiceResult={practiceResult}
          runs={practiceRuns}
          onOpenPractice={(id) => {
            setPracticeSetId(id);
            setActive("Practice");
            setView("student-practice");
          }}
          submissions={visibleStudentSubmissions}
          onNavigate={navigate}
          onLogout={logout}
        />
      );
    if (view === "teacher-dashboard")
      return (
        <TeacherHome
          queue={reviewQueue}
          flagsToDecide={flagReadyCount}
          studentList={liveStudents}
          scope={scope}
          onScope={setScope}
          onContinue={continueReview}
          onOpenGrading={openGrading}
          onNavigate={navigate}
          onLogout={logout}
        />
      );
    if (view === "teacher-ocr")
      return (
        <TeacherOCRVerification
          tasks={ocrTasks}
          selectedId={selectedOcrId}
          onSelect={selectIn(ocrTasks, setSelectedOcrId)}
          scope={scope}
          onScope={setScope}
          onUpdateAnswers={updateOcrAnswers}
          onComplete={completeOcr}
          onRequestReupload={(taskId, message) => {
            const task = ocrTasks.find((entry) => entry.id === taskId);
            if (!task) return;
            setReuploadRequests((current) => ({
              ...current,
              [taskId]: { studentId: task.studentId, title: task.title, message },
            }));
            setGradingTab("missing");
            setActive("Grading");
            setView("teacher-grading-list");
          }}
          onReopen={reopenOcr}
          onNavigate={navigate}
          onLogout={logout}
        />
      );
    if (view === "teacher-grade")
      return (
        <TeacherGradeReview
          tasks={gradeTasks}
          selectedId={selectedGradeId}
          onSelect={selectIn(gradeTasks, setSelectedGradeId)}
          scope={scope}
          onScope={setScope}
          ocrAnswers={teacherWorkflow.ocrAnswers}
          onUpdateQuestions={updateGradeQuestions}
          onFinalize={finalizeGrade}
          onReopen={reopenGrade}
          onNavigate={navigate}
          onLogout={logout}
        />
      );
    if (view === "teacher-grading-list")
      return (
        <TeacherGradingList
          studentList={liveStudents}
          tab={gradingTab}
          onTab={setGradingTab}
          reminders={reminders}
          reuploads={Object.fromEntries(
            Object.values(reuploadRequests).map((request) => [request.studentId, request.title]),
          )}
          onRemind={(studentId, message) =>
            setReminders((current) => ({ ...current, [studentId]: message }))
          }
          onNavigate={navigate}
          onLogout={logout}
        />
      );
    if (view === "teacher-gaps-overview")
      return (
        <TeacherGapsOverview
          studentList={liveStudents}
          gaps={gaps}
          assignments={practiceAssignments}
          tab={gapsTab}
          onTab={(tab) => {
            setGapsTab(tab);
            setFreshAssignmentId(null);
          }}
          highlightId={freshAssignmentId}
          onCreate={(studentId) => {
            setBuilderStudentId(studentId);
            setBuilderAssignmentId(null);
            setView("teacher-practice-builder");
          }}
          onEdit={(assignmentId) => {
            const assignment = practiceAssignments.find((entry) => entry.id === assignmentId);
            if (!assignment) return;
            setBuilderStudentId(assignment.studentId);
            setBuilderAssignmentId(assignmentId);
            setView("teacher-practice-builder");
          }}
          onRemove={(assignmentId) =>
            setPracticeAssignments((current) =>
              current.filter((entry) => entry.id !== assignmentId),
            )
          }
          onNavigate={navigate}
          onLogout={logout}
        />
      );
    if (view === "teacher-practice-builder") {
      const student = liveStudents.find((entry) => entry.id === builderStudentId);
      const gap = gaps.find(
        (entry) => entry.studentId === builderStudentId && entry.status !== "dismissed",
      );
      const existing = practiceAssignments.find((entry) => entry.id === builderAssignmentId);
      const backTo = (tab: GapsTab) => {
        setGapsTab(tab);
        setView("teacher-gaps-overview");
      };
      if (student)
        return (
          <TeacherPracticeBuilder
            key={existing?.id ?? `new-${student.id}`}
            student={student}
            gap={gap}
            suggested={
              feedbackItems.find((entry) => entry.id === gap?.gradeTaskId)?.draft.questions ?? []
            }
            existing={existing}
            onAssign={(draft) => {
              if (existing) {
                setPracticeAssignments((current) =>
                  current.map((entry) =>
                    entry.id === existing.id ? { ...entry, ...draft } : entry,
                  ),
                );
                setFreshAssignmentId(existing.id);
              } else {
                const id = `pa-${Date.now()}`;
                setPracticeAssignments((current) => [
                  { id, studentId: student.id, createdAt: "today", ...draft },
                  ...current,
                ]);
                setFreshAssignmentId(id);
              }
              backTo("assigned");
            }}
            onBack={() => backTo(existing ? "assigned" : "create")}
            onNavigate={navigate}
            onLogout={logout}
          />
        );
    }
    if (view === "teacher-students")
      return (
        <TeacherStudents
          baseStudents={students}
          studentList={liveStudents}
          flagStates={flagStates}
          ocrTasks={ocrTasks}
          gradeTasks={gradeTasks}
          gaps={gaps}
          feedbackItems={feedbackItems}
          threshold={flagThreshold}
          selectedId={profileId}
          onSelect={(id) => {
            setProfileId(id);
            const student = students.find((item) => item.id === id);
            if (student) focusClass(student.className);
          }}
          scope={scope}
          onScope={setScope}
          onOpenOcr={openOcrTask}
          onOpenGrade={openGradeTask}
          onOpenGap={openStudentGap}
          onOpenFeedback={openFeedbackItem}
          onOpenFlags={openFlagsFor}
          onNavigate={navigate}
          onLogout={logout}
        />
      );
    if (view === "teacher-flags")
      return (
        <TeacherRedFlags
          flagStates={flagStates}
          threshold={flagThreshold}
          setThreshold={setFlagThreshold}
          onDecide={decideFlag}
          gaps={gaps}
          onOpenGap={openStudentGap}
          scope={scope}
          onScope={setScope}
          onNavigate={navigate}
          onLogout={logout}
        />
      );
    if (view === "teacher-feedback")
      return (
        <TeacherFeedbackApproval
          items={feedbackItems}
          selectedId={selectedFeedbackId}
          onSelect={selectIn(feedbackItems, setSelectedFeedbackId)}
          onUpdate={updateFeedback}
          onSend={sendFeedback}
          onReviewPractice={reviewPractice}
          onOpenGrade={openGradeTask}
          gapFor={(examId) => gaps.find((gap) => gap.gradeTaskId === examId)}
          onUpdateGap={updateGap}
          scope={scope}
          onScope={setScope}
          onNavigate={navigate}
          onLogout={logout}
        />
      );
    return <Placeholder role={role} active={active} onNavigate={navigate} onLogout={logout} />;
  };

  return (
    <SidebarContext.Provider value={sidebarState}>
      <NavCountContext.Provider
        value={{
          Grading: gradingQueue.filter((item) => item.actionRequired).length,
          "Red Flags": flagReadyCount,
        }}
      >
        <StudentNotificationContext.Provider
          value={{
            studentNotifications,
            onOpenStudentNotification: openStudentNotification,
          }}
        >
          <OpenProfileContext.Provider value={role === "teacher" ? openProfile : null}>
            <ReviewStepsContext.Provider
              value={{
                stepsFor: reviewStepsFor,
                open: openReviewStep,
                queue: gradingQueue,
                pick: pickExam,
                filter: queueFilter,
                setFilter: setQueueFilter,
                back: () => openGrading(),
              }}
            >
              {renderScreen()}
            </ReviewStepsContext.Provider>
          </OpenProfileContext.Provider>
        </StudentNotificationContext.Provider>
      </NavCountContext.Provider>
    </SidebarContext.Provider>
  );
}
