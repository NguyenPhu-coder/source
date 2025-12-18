import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Brain,
    Clock,
    CheckCircle,
    XCircle,
    Trophy,
    ArrowLeft,
    ArrowRight,
    Send,
    Loader2,
    BookOpen,
    Target,
    Award,
    AlertCircle,
} from 'lucide-react';
import apiClient from '@/api/client';

interface Question {
    index: number;
    question: string;
    type: 'multiple_choice' | 'true_false' | 'fill_blank';
    options: string[];
    difficulty: string;
    bloomLevel?: string;
    correctAnswer?: string | number;
    explanation?: string;
}

interface QuizData {
    id: number;
    title: string;
    description: string;
    courseTitle: string;
    courseId: number;
    passingScore: number;
    timeLimit: number;
    status: 'pending' | 'completed' | 'expired';
    score: number | null;
    passed: boolean | null;
    attemptedAt: string | null;
    createdAt: string;
    questions: Question[];
}

interface SubmitResult {
    score: number;
    passed: boolean;
    passingScore: number;
    results: {
        questionIndex: number;
        userAnswer: string | number;
        correctAnswer: string | number;
        isCorrect: boolean;
        explanation: string;
    }[];
}

const AutoQuizPage: React.FC = () => {
    const { quizId } = useParams<{ quizId: string }>();
    const navigate = useNavigate();

    const [quiz, setQuiz] = useState<QuizData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [answers, setAnswers] = useState<{ [key: number]: string | number }>({});
    const [timeLeft, setTimeLeft] = useState<number>(0);
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState<SubmitResult | null>(null);
    const [showExplanation, setShowExplanation] = useState(false);

    useEffect(() => {
        fetchQuiz();
    }, [quizId]);

    useEffect(() => {
        if (quiz && quiz.status === 'pending' && timeLeft > 0) {
            const timer = setInterval(() => {
                setTimeLeft((prev) => {
                    if (prev <= 1) {
                        clearInterval(timer);
                        handleSubmit();
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
            return () => clearInterval(timer);
        }
    }, [quiz, timeLeft]);

    const fetchQuiz = async () => {
        try {
            setLoading(true);
            const response = await apiClient.get(`/api/agents/auto-quiz/${quizId}`);
            if (response.data.success) {
                setQuiz(response.data.data);
                if (response.data.data.status === 'pending') {
                    setTimeLeft(response.data.data.timeLimit * 60);
                }
            }
        } catch (err: any) {
            setError(err.response?.data?.error || 'Không thể tải bài tập');
        } finally {
            setLoading(false);
        }
    };

    const handleAnswerChange = (questionIndex: number, answer: string | number) => {
        setAnswers((prev) => ({
            ...prev,
            [questionIndex]: answer,
        }));
    };

    const handleSubmit = async () => {
        if (!quiz) return;

        try {
            setSubmitting(true);
            const answersArray = quiz.questions.map((q, idx) => ({
                questionIndex: idx,
                answer: answers[idx] ?? '',
            }));

            const response = await apiClient.post(`/api/agents/auto-quiz/${quizId}/submit`, {
                answers: answersArray,
            });

            if (response.data.success) {
                setResult(response.data.data);
                setShowExplanation(true);
                // Refresh quiz data to get updated status
                fetchQuiz();
            }
        } catch (err: any) {
            setError(err.response?.data?.error || 'Không thể nộp bài');
        } finally {
            setSubmitting(false);
        }
    };

    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const getDifficultyColor = (difficulty: string): string => {
        switch (difficulty.toLowerCase()) {
            case 'easy': return 'text-green-600 bg-green-100';
            case 'medium': return 'text-yellow-600 bg-yellow-100';
            case 'hard': return 'text-red-600 bg-red-100';
            default: return 'text-gray-600 bg-gray-100';
        }
    };

    const getBloomColor = (level: string): string => {
        const colors: { [key: string]: string } = {
            remember: 'bg-blue-100 text-blue-700',
            understand: 'bg-green-100 text-green-700',
            apply: 'bg-yellow-100 text-yellow-700',
            analyze: 'bg-orange-100 text-orange-700',
            evaluate: 'bg-red-100 text-red-700',
            create: 'bg-purple-100 text-purple-700',
        };
        return colors[level.toLowerCase()] || 'bg-gray-100 text-gray-700';
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
                    <p className="text-gray-600">Đang tải bài tập...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <p className="text-red-600 mb-4">{error}</p>
                    <button
                        onClick={() => navigate(-1)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                        Quay lại
                    </button>
                </div>
            </div>
        );
    }

    if (!quiz) return null;

    // Show result page if quiz is completed
    if (quiz.status === 'completed' || result) {
        const displayResult = result || {
            score: quiz.score || 0,
            passed: quiz.passed || false,
            passingScore: quiz.passingScore,
            results: [],
        };

        return (
            <div className="min-h-screen bg-gray-50 py-8">
                <div className="max-w-4xl mx-auto px-4">
                    {/* Result Header */}
                    <div className={`rounded-2xl p-8 text-center mb-8 ${displayResult.passed
                        ? 'bg-gradient-to-r from-green-500 to-emerald-600'
                        : 'bg-gradient-to-r from-orange-500 to-red-600'
                        }`}>
                        {displayResult.passed ? (
                            <Trophy className="w-20 h-20 text-white mx-auto mb-4" />
                        ) : (
                            <Target className="w-20 h-20 text-white mx-auto mb-4" />
                        )}
                        <h1 className="text-3xl font-bold text-white mb-2">
                            {displayResult.passed ? '🎉 Xuất sắc!' : '💪 Cố gắng thêm!'}
                        </h1>
                        <p className="text-white/90 text-lg mb-4">
                            {displayResult.passed
                                ? 'Bạn đã hoàn thành bài tập tổng kết thành công!'
                                : 'Bạn cần cải thiện thêm để đạt điểm đậu.'
                            }
                        </p>
                        <div className="flex justify-center gap-8">
                            <div className="text-center">
                                <p className="text-5xl font-bold text-white">{displayResult.score}%</p>
                                <p className="text-white/80">Điểm của bạn</p>
                            </div>
                            <div className="text-center">
                                <p className="text-5xl font-bold text-white">{displayResult.passingScore}%</p>
                                <p className="text-white/80">Điểm đậu</p>
                            </div>
                        </div>
                        {displayResult.passed && (
                            <div className="mt-4 inline-flex items-center gap-2 bg-white/20 px-4 py-2 rounded-full">
                                <Award className="w-5 h-5 text-yellow-300" />
                                <span className="text-white font-medium">+100 điểm thưởng!</span>
                            </div>
                        )}
                    </div>

                    {/* Quiz Info */}
                    <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                        <h2 className="text-xl font-semibold text-gray-800 mb-2">{quiz.title}</h2>
                        <p className="text-gray-600">Khóa học: {quiz.courseTitle}</p>
                    </div>

                    {/* Question Review */}
                    {showExplanation && result && (
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold text-gray-800">Xem lại câu trả lời</h3>
                            {quiz.questions.map((question, idx) => {
                                const userResult = result.results.find(r => r.questionIndex === idx);
                                return (
                                    <div
                                        key={idx}
                                        className={`bg-white rounded-xl shadow-sm p-6 border-l-4 ${userResult?.isCorrect ? 'border-green-500' : 'border-red-500'
                                            }`}
                                    >
                                        <div className="flex items-start gap-3 mb-4">
                                            {userResult?.isCorrect ? (
                                                <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0" />
                                            ) : (
                                                <XCircle className="w-6 h-6 text-red-500 flex-shrink-0" />
                                            )}
                                            <div>
                                                <p className="font-medium text-gray-800">Câu {idx + 1}: {question.question}</p>
                                                <div className="flex gap-2 mt-2">
                                                    <span className={`text-xs px-2 py-1 rounded ${getDifficultyColor(question.difficulty)}`}>
                                                        {question.difficulty}
                                                    </span>
                                                    {question.bloomLevel && (
                                                        <span className={`text-xs px-2 py-1 rounded ${getBloomColor(question.bloomLevel)}`}>
                                                            {question.bloomLevel}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="ml-9 space-y-2">
                                            <p className="text-sm">
                                                <span className="text-gray-500">Câu trả lời của bạn: </span>
                                                <span className={userResult?.isCorrect ? 'text-green-600' : 'text-red-600'}>
                                                    {typeof userResult?.userAnswer === 'number'
                                                        ? question.options[userResult.userAnswer]
                                                        : userResult?.userAnswer || '(Chưa trả lời)'}
                                                </span>
                                            </p>
                                            {!userResult?.isCorrect && (
                                                <p className="text-sm">
                                                    <span className="text-gray-500">Đáp án đúng: </span>
                                                    <span className="text-green-600">
                                                        {typeof question.correctAnswer === 'number'
                                                            ? question.options[question.correctAnswer]
                                                            : question.correctAnswer}
                                                    </span>
                                                </p>
                                            )}
                                            {question.explanation && (
                                                <div className="bg-blue-50 p-3 rounded-lg mt-2">
                                                    <p className="text-sm text-blue-800">
                                                        <strong>Giải thích:</strong> {question.explanation}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Actions */}
                    <div className="mt-8 flex justify-center gap-4">
                        <button
                            onClick={() => navigate('/my-learning')}
                            className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition flex items-center gap-2"
                        >
                            <BookOpen className="w-5 h-5" />
                            Về trang học tập
                        </button>
                        <button
                            onClick={() => navigate('/auto-quizzes')}
                            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
                        >
                            <Brain className="w-5 h-5" />
                            Xem các bài tập khác
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Quiz taking interface
    const question = quiz.questions[currentQuestion];
    const progress = ((currentQuestion + 1) / quiz.questions.length) * 100;
    const answeredCount = Object.keys(answers).length;

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white shadow-sm sticky top-0 z-10">
                <div className="max-w-4xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-lg font-semibold text-gray-800">{quiz.title}</h1>
                            <p className="text-sm text-gray-500">{quiz.courseTitle}</p>
                        </div>
                        <div className="flex items-center gap-6">
                            <div className="flex items-center gap-2 text-gray-600">
                                <Target className="w-5 h-5" />
                                <span>{answeredCount}/{quiz.questions.length} đã trả lời</span>
                            </div>
                            <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${timeLeft < 60 ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'
                                }`}>
                                <Clock className="w-5 h-5" />
                                <span className="font-mono font-bold">{formatTime(timeLeft)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Progress bar */}
                    <div className="mt-4 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-blue-600 transition-all duration-300"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-4xl mx-auto px-4 py-8">
                <div className="bg-white rounded-2xl shadow-lg p-8">
                    {/* Question Header */}
                    <div className="flex items-center justify-between mb-6">
                        <span className="text-sm font-medium text-blue-600 bg-blue-100 px-3 py-1 rounded-full">
                            Câu {currentQuestion + 1} / {quiz.questions.length}
                        </span>
                        <div className="flex gap-2">
                            <span className={`text-xs px-2 py-1 rounded ${getDifficultyColor(question.difficulty)}`}>
                                {question.difficulty === 'easy' ? 'Dễ' : question.difficulty === 'medium' ? 'Trung bình' : 'Khó'}
                            </span>
                            {question.bloomLevel && (
                                <span className={`text-xs px-2 py-1 rounded ${getBloomColor(question.bloomLevel)}`}>
                                    {question.bloomLevel}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Question */}
                    <h2 className="text-xl font-medium text-gray-800 mb-6">{question.question}</h2>

                    {/* Options */}
                    <div className="space-y-3">
                        {question.options.map((option, idx) => (
                            <label
                                key={idx}
                                className={`flex items-center p-4 rounded-xl border-2 cursor-pointer transition-all ${answers[currentQuestion] === idx
                                    ? 'border-blue-500 bg-blue-50'
                                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                    }`}
                            >
                                <input
                                    type="radio"
                                    name={`question-${currentQuestion}`}
                                    value={idx}
                                    checked={answers[currentQuestion] === idx}
                                    onChange={() => handleAnswerChange(currentQuestion, idx)}
                                    className="sr-only"
                                />
                                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center mr-4 ${answers[currentQuestion] === idx
                                    ? 'border-blue-500 bg-blue-500'
                                    : 'border-gray-300'
                                    }`}>
                                    {answers[currentQuestion] === idx && (
                                        <div className="w-3 h-3 rounded-full bg-white" />
                                    )}
                                </div>
                                <span className="text-gray-700">{option}</span>
                            </label>
                        ))}
                    </div>
                </div>

                {/* Navigation */}
                <div className="mt-6 flex items-center justify-between">
                    <button
                        onClick={() => setCurrentQuestion((prev) => Math.max(0, prev - 1))}
                        disabled={currentQuestion === 0}
                        className="flex items-center gap-2 px-6 py-3 text-gray-600 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        Câu trước
                    </button>

                    <div className="flex gap-2">
                        {quiz.questions.map((_, idx) => (
                            <button
                                key={idx}
                                onClick={() => setCurrentQuestion(idx)}
                                className={`w-10 h-10 rounded-lg font-medium transition ${idx === currentQuestion
                                    ? 'bg-blue-600 text-white'
                                    : answers[idx] !== undefined
                                        ? 'bg-green-100 text-green-700'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                            >
                                {idx + 1}
                            </button>
                        ))}
                    </div>

                    {currentQuestion < quiz.questions.length - 1 ? (
                        <button
                            onClick={() => setCurrentQuestion((prev) => Math.min(quiz.questions.length - 1, prev + 1))}
                            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                        >
                            Câu tiếp
                            <ArrowRight className="w-5 h-5" />
                        </button>
                    ) : (
                        <button
                            onClick={handleSubmit}
                            disabled={submitting}
                            className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                        >
                            {submitting ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Đang nộp...
                                </>
                            ) : (
                                <>
                                    <Send className="w-5 h-5" />
                                    Nộp bài
                                </>
                            )}
                        </button>
                    )}
                </div>

                {/* Submit Early */}
                {answeredCount === quiz.questions.length && currentQuestion !== quiz.questions.length - 1 && (
                    <div className="mt-6 text-center">
                        <button
                            onClick={handleSubmit}
                            disabled={submitting}
                            className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                        >
                            <CheckCircle className="w-5 h-5" />
                            Nộp bài ngay
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AutoQuizPage;
