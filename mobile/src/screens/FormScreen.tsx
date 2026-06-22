import React, { useState, useEffect } from 'react';
import {
	SafeAreaView,
	View,
	Text,
	StyleSheet,
	ScrollView,
	TouchableOpacity,
	ActivityIndicator,
	TextInput,
	Alert,
	Dimensions,
} from 'react-native';
import { getForm, submitFormResponse, Form, Question, QuestionAnswer, getUserProfile } from '../api/client';

const { width } = Dimensions.get('window');

interface FormScreenProps {
	route: {
		params: {
			issueId: number;
			issueTitle: string;
		};
	};
	navigation: any;
}

export default function FormScreen({ route, navigation }: FormScreenProps) {
	const { issueId, issueTitle } = route.params;
	const [form, setForm] = useState<Form | null>(null);
	const [loading, setLoading] = useState(true);
	const [submitting, setSubmitting] = useState(false);
	const [answers, setAnswers] = useState<Record<number, QuestionAnswer>>({});
	const [isGroupTherapy, setIsGroupTherapy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		loadForm();
	}, [issueId]);

	const loadForm = async () => {
		try {
			setLoading(true);
			setError(null);
			const formData = await getForm(issueId);
			setForm(formData);
			
			// Initialize answers object - only for required questions
			const initialAnswers: Record<number, QuestionAnswer> = {};
			// Don't pre-initialize - let answers be set only when user provides them
			setAnswers(initialAnswers);
		} catch (e: any) {
			setError(e?.response?.data?.detail || 'خطا در بارگذاری فرم');
			console.error('Error loading form:', e);
		} finally {
			setLoading(false);
		}
	};

	const updateAnswer = (questionId: number, value: any, type: string) => {
		setAnswers((prev) => {
			const newAnswer: QuestionAnswer = {
				question_id: questionId,
			};
			
			if (type === 'yes_no') {
				newAnswer.answer_boolean = value;
			} else if (type === 'number') {
				// Handle number input
				if (value === '' || value === null || value === undefined) {
					newAnswer.answer_number = null;
				} else {
					const num = parseFloat(value);
					newAnswer.answer_number = isNaN(num) ? null : num;
				}
			} else {
				// For text questions (descriptive, short_text, multiple_choice_4)
				newAnswer.answer_text = value || '';
			}
			
			return {
				...prev,
				[questionId]: newAnswer,
			};
		});
	};

	const validateForm = (): { valid: boolean; missingQuestion?: string } => {
		if (!form) return { valid: false };
		
		for (const question of form.questions) {
			if (question.is_required) {
				const answer = answers[question.id];
				
				// Check if answer exists and has valid data
				let hasValidAnswer = false;
				
				if (answer) {
					if (question.question_type === 'yes_no') {
						hasValidAnswer = answer.answer_boolean !== undefined && answer.answer_boolean !== null;
					} else if (question.question_type === 'number') {
						hasValidAnswer = answer.answer_number !== undefined && answer.answer_number !== null;
					} else {
						// For text questions (descriptive, short_text, multiple_choice_4)
						hasValidAnswer = answer.answer_text !== undefined && 
										 answer.answer_text !== null && 
										 answer.answer_text.trim() !== '';
					}
				}
				
				if (!hasValidAnswer) {
					return { valid: false, missingQuestion: question.text_fa || question.text };
				}
			}
		}
		
		return { valid: true };
	};

	const handleSubmit = async () => {
		if (!form) return;

		try {
			setSubmitting(true);
			
			// First, check profile completion - this should be checked first
			const profile = await getUserProfile();
			if (!profile.is_complete) {
				setSubmitting(false);
				Alert.alert(
					'پروفایل ناقص است',
					`لطفاً ابتدا اطلاعات پروفایل خود را تکمیل کنید.\n\nفیلدهای خالی: ${profile.missing_fields.join(', ')}`,
					[
						{
							text: 'تکمیل پروفایل',
							onPress: () => {
								navigation.navigate('Profile', {
									redirectAfterComplete: true,
									returnToForm: {
										issueId,
										issueTitle: form.title_fa || form.title || issueTitle,
									},
								});
							},
						},
						{
							text: 'لغو',
							style: 'cancel',
						},
					]
				);
				return;
			}
			
			// Then validate form
			const validation = validateForm();
			if (!validation.valid) {
				setSubmitting(false);
				const message = validation.missingQuestion 
					? `لطفاً سوال زیر را پاسخ دهید:\n${validation.missingQuestion}`
					: 'لطفاً تمام سوالات اجباری را پاسخ دهید';
				console.log('Form validation failed:', { validation, answers });
				Alert.alert('خطا', message);
				return;
			}
			const answersArray = Object.values(answers).filter(ans => {
				// Filter out empty answers
				if (!ans) return false;
				if (ans.answer_boolean !== undefined && ans.answer_boolean !== null) return true;
				if (ans.answer_number !== undefined && ans.answer_number !== null) return true;
				if (ans.answer_text && ans.answer_text.trim() !== '') return true;
				return false;
			});
			
			const result = await submitFormResponse({
				psychological_issue_id: issueId,
				answers: answersArray,
				is_group_therapy: isGroupTherapy,
			});
			
			if (result.is_group_therapy && result.pending) {
				Alert.alert(
					'در انتظار گروه',
					`${result.message}\n\nدر حال حاضر ${result.current_count} از ${result.required_count} بیمار ثبت نام کرده‌اند.`,
					[
						{
							text: 'باشه',
							onPress: () => navigation.goBack(),
						},
					]
				);
			} else {
				Alert.alert('موفقیت', result.message, [
				{
					text: 'باشه',
					onPress: () => navigation.goBack(),
				},
			]);
			}
		} catch (e: any) {
			// Check if error is due to incomplete profile
			if (e?.response?.data?.profile_incomplete) {
				const missingFields = e?.response?.data?.missing_fields || [];
				Alert.alert(
					'پروفایل ناقص است',
					`لطفاً ابتدا اطلاعات پروفایل خود را تکمیل کنید.\n\nفیلدهای خالی: ${missingFields.join(', ')}`,
					[
						{
							text: 'تکمیل پروفایل',
							onPress: () => {
								navigation.navigate('Profile', {
									redirectAfterComplete: true,
									returnToForm: {
										issueId,
										issueTitle: form?.title_fa || form?.title || issueTitle,
									},
								});
							},
						},
						{
							text: 'لغو',
							style: 'cancel',
						},
					]
				);
			} else {
				Alert.alert(
					'خطا',
					e?.response?.data?.detail || 'خطا در ثبت پاسخ. لطفاً دوباره تلاش کنید'
				);
			}
			console.error('Error submitting form:', e);
		} finally {
			setSubmitting(false);
		}
	};

	const renderQuestion = (question: Question) => {
		const answer = answers[question.id];
		
		switch (question.question_type) {
			case 'yes_no':
				return (
					<View key={question.id} style={styles.questionContainer}>
						<Text style={styles.questionText}>
							{question.text_fa || question.text}
							{question.is_required && <Text style={styles.required}> *</Text>}
						</Text>
						<View style={styles.yesNoContainer}>
							<TouchableOpacity
								style={[
									styles.yesNoButton,
									answer?.answer_boolean === true && styles.yesNoButtonSelected,
								]}
								onPress={() => updateAnswer(question.id, true, 'yes_no')}
							>
								<Text
									style={[
										styles.yesNoText,
										answer?.answer_boolean === true && styles.yesNoTextSelected,
									]}
								>
									بله
								</Text>
							</TouchableOpacity>
							<TouchableOpacity
								style={[
									styles.yesNoButton,
									answer?.answer_boolean === false && styles.yesNoButtonSelected,
								]}
								onPress={() => updateAnswer(question.id, false, 'yes_no')}
							>
								<Text
									style={[
										styles.yesNoText,
										answer?.answer_boolean === false && styles.yesNoTextSelected,
									]}
								>
									خیر
								</Text>
							</TouchableOpacity>
						</View>
					</View>
				);

			case 'multiple_choice_4':
				const options = question.options_list || [];
				return (
					<View key={question.id} style={styles.questionContainer}>
						<Text style={styles.questionText}>
							{question.text_fa || question.text}
							{question.is_required && <Text style={styles.required}> *</Text>}
						</Text>
						<View style={styles.optionsContainer}>
							{options.map((option, index) => (
								<TouchableOpacity
									key={index}
									style={[
										styles.optionButton,
										answer?.answer_text === option && styles.optionButtonSelected,
									]}
									onPress={() => updateAnswer(question.id, option, 'multiple_choice_4')}
								>
									<Text
										style={[
											styles.optionText,
											answer?.answer_text === option && styles.optionTextSelected,
										]}
									>
										{option}
									</Text>
								</TouchableOpacity>
							))}
						</View>
					</View>
				);

			case 'descriptive':
				return (
					<View key={question.id} style={styles.questionContainer}>
						<Text style={styles.questionText}>
							{question.text_fa || question.text}
							{question.is_required && <Text style={styles.required}> *</Text>}
						</Text>
						<TextInput
							style={[styles.input, styles.textArea]}
							value={answer?.answer_text || ''}
							onChangeText={(text) => updateAnswer(question.id, text, 'descriptive')}
							placeholder="پاسخ خود را بنویسید..."
							placeholderTextColor="#9ca3af"
							multiline
							numberOfLines={5}
							textAlignVertical="top"
							writingDirection="rtl"
							textAlign="right"
						/>
					</View>
				);

			case 'short_text':
				return (
					<View key={question.id} style={styles.questionContainer}>
						<Text style={styles.questionText}>
							{question.text_fa || question.text}
							{question.is_required && <Text style={styles.required}> *</Text>}
						</Text>
						<TextInput
							style={styles.input}
							value={answer?.answer_text || ''}
							onChangeText={(text) => updateAnswer(question.id, text, 'short_text')}
							placeholder="پاسخ خود را بنویسید..."
							placeholderTextColor="#9ca3af"
							writingDirection="rtl"
							textAlign="right"
						/>
					</View>
				);

			case 'number':
				return (
					<View key={question.id} style={styles.questionContainer}>
						<Text style={styles.questionText}>
							{question.text_fa || question.text}
							{question.is_required && <Text style={styles.required}> *</Text>}
						</Text>
						<TextInput
							style={styles.input}
							value={answer?.answer_number?.toString() || ''}
							onChangeText={(text) => {
								const num = text ? parseFloat(text) : null;
								updateAnswer(question.id, num, 'number');
							}}
							placeholder="عدد وارد کنید..."
							placeholderTextColor="#9ca3af"
							keyboardType="numeric"
							textAlign="right"
						/>
					</View>
				);

			default:
				return null;
		}
	};

	if (loading) {
		return (
			<SafeAreaView style={styles.container}>
				<View style={styles.loadingContainer}>
					<ActivityIndicator size="large" color="#4a5568" />
					<Text style={styles.loadingText}>در حال بارگذاری فرم...</Text>
				</View>
			</SafeAreaView>
		);
	}

	if (error || !form) {
		return (
			<SafeAreaView style={styles.container}>
				<View style={styles.errorContainer}>
					<Text style={styles.errorText}>{error || 'فرم یافت نشد'}</Text>
					<TouchableOpacity onPress={loadForm} style={styles.retryButton}>
						<Text style={styles.retryButtonText}>تلاش مجدد</Text>
					</TouchableOpacity>
					<TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
						<Text style={styles.backButtonText}>بازگشت</Text>
					</TouchableOpacity>
				</View>
			</SafeAreaView>
		);
	}

	return (
		<SafeAreaView style={styles.container}>
			<View style={styles.background}>
				<View style={styles.gradientCircle1} />
				<View style={styles.gradientCircle2} />
			</View>

			<View style={styles.header}>
				<TouchableOpacity onPress={() => navigation.goBack()} style={styles.backIconButton}>
					<Text style={styles.backIcon}>←</Text>
				</TouchableOpacity>
				<View style={styles.headerContent}>
					<Text style={styles.headerTitle}>{form.title_fa || form.title}</Text>
					{issueTitle && (
						<Text style={styles.headerSubtitle}>{issueTitle}</Text>
					)}
				</View>
			</View>

			{form.description && (
				<View style={styles.descriptionContainer}>
					<Text style={styles.descriptionText}>{form.description}</Text>
				</View>
			)}

			<ScrollView
				contentContainerStyle={styles.scrollContent}
				showsVerticalScrollIndicator={false}
			>
				{form.group_therapy_enabled && (
					<View style={styles.groupTherapyContainer}>
						<TouchableOpacity
							style={styles.groupTherapyCheckbox}
							onPress={() => setIsGroupTherapy(!isGroupTherapy)}
							activeOpacity={0.7}
						>
							<View style={[styles.checkbox, isGroupTherapy && styles.checkboxChecked]}>
								{isGroupTherapy && <Text style={styles.checkmark}>✓</Text>}
							</View>
							<View style={styles.groupTherapyTextContainer}>
								<Text style={styles.groupTherapyTitle}>درمان گروهی</Text>
								<Text style={styles.groupTherapyDescription}>
									با انتخاب این گزینه، شما در یک گروه درمانی با حداکثر {form.group_therapy_max_patients} بیمار شرکت خواهید کرد
								</Text>
							</View>
						</TouchableOpacity>
					</View>
				)}
				{form.questions.map((question) => renderQuestion(question))}
			</ScrollView>

			<View style={styles.footer}>
				<TouchableOpacity
					style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
					onPress={handleSubmit}
					disabled={submitting}
				>
					{submitting ? (
						<ActivityIndicator color="#fff" size="small" />
					) : (
						<Text style={styles.submitButtonText}>ثبت پاسخ</Text>
					)}
				</TouchableOpacity>
			</View>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#2d3748',
	},
	background: {
		position: 'absolute',
		width: '100%',
		height: '100%',
	},
	gradientCircle1: {
		position: 'absolute',
		width: width * 1.2,
		height: width * 1.2,
		borderRadius: width * 0.6,
		backgroundColor: '#4a5568',
		opacity: 0.15,
		top: -width * 0.3,
		right: -width * 0.3,
	},
	gradientCircle2: {
		position: 'absolute',
		width: width * 0.8,
		height: width * 0.8,
		borderRadius: width * 0.4,
		backgroundColor: '#718096',
		opacity: 0.1,
		bottom: -width * 0.2,
		left: -width * 0.2,
	},
	loadingContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
	},
	loadingText: {
		marginTop: 16,
		fontSize: 16,
		color: '#a0aec0',
		writingDirection: 'rtl',
		textAlign: 'center',
	},
	errorContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		padding: 20,
	},
	errorText: {
		fontSize: 16,
		color: '#fff',
		textAlign: 'center',
		marginBottom: 20,
		writingDirection: 'rtl',
	},
	retryButton: {
		paddingVertical: 12,
		paddingHorizontal: 24,
		backgroundColor: '#4a5568',
		borderRadius: 8,
		marginBottom: 12,
	},
	retryButtonText: {
		color: '#fff',
		fontSize: 16,
		fontWeight: '600',
	},
	backButton: {
		paddingVertical: 12,
		paddingHorizontal: 24,
		backgroundColor: '#718096',
		borderRadius: 8,
	},
	backButtonText: {
		color: '#fff',
		fontSize: 16,
		fontWeight: '600',
	},
	header: {
		flexDirection: 'row',
		alignItems: 'center',
		padding: 20,
		paddingTop: 16,
		paddingBottom: 8,
	},
	backIconButton: {
		width: 40,
		height: 40,
		justifyContent: 'center',
		alignItems: 'center',
		marginLeft: 12,
	},
	backIcon: {
		fontSize: 24,
		color: '#f7fafc',
		fontWeight: 'bold',
	},
	headerContent: {
		flex: 1,
	},
	headerTitle: {
		fontSize: 24,
		fontWeight: '800',
		color: '#f7fafc',
		textAlign: 'right',
		writingDirection: 'rtl',
	},
	headerSubtitle: {
		fontSize: 14,
		color: '#a0aec0',
		textAlign: 'right',
		marginTop: 4,
		writingDirection: 'rtl',
	},
	descriptionContainer: {
		paddingHorizontal: 20,
		paddingBottom: 12,
	},
	descriptionText: {
		fontSize: 14,
		color: '#cbd5e0',
		textAlign: 'right',
		lineHeight: 20,
		writingDirection: 'rtl',
	},
	scrollContent: {
		padding: 20,
		paddingTop: 8,
		paddingBottom: 100,
	},
	questionContainer: {
		backgroundColor: '#f7fafc',
		borderRadius: 16,
		padding: 20,
		marginBottom: 16,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.1,
		shadowRadius: 8,
		elevation: 4,
	},
	questionText: {
		fontSize: 16,
		fontWeight: '700',
		color: '#2d3748',
		marginBottom: 12,
		writingDirection: 'rtl',
		textAlign: 'right',
	},
	required: {
		color: '#e53e3e',
	},
	input: {
		backgroundColor: '#edf2f7',
		borderWidth: 2,
		borderColor: '#e2e8f0',
		borderRadius: 12,
		padding: 16,
		fontSize: 16,
		color: '#2d3748',
		writingDirection: 'rtl',
		textAlign: 'right',
	},
	textArea: {
		minHeight: 120,
		paddingTop: 16,
	},
	yesNoContainer: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		gap: 12,
	},
	yesNoButton: {
		flex: 1,
		paddingVertical: 14,
		paddingHorizontal: 20,
		borderRadius: 12,
		backgroundColor: '#edf2f7',
		borderWidth: 2,
		borderColor: '#e2e8f0',
		alignItems: 'center',
	},
	yesNoButtonSelected: {
		backgroundColor: '#4a5568',
		borderColor: '#4a5568',
	},
	yesNoText: {
		fontSize: 16,
		fontWeight: '600',
		color: '#4a5568',
	},
	yesNoTextSelected: {
		color: '#fff',
	},
	optionsContainer: {
		gap: 12,
	},
	optionButton: {
		paddingVertical: 14,
		paddingHorizontal: 20,
		borderRadius: 12,
		backgroundColor: '#edf2f7',
		borderWidth: 2,
		borderColor: '#e2e8f0',
	},
	optionButtonSelected: {
		backgroundColor: '#4a5568',
		borderColor: '#4a5568',
	},
	optionText: {
		fontSize: 16,
		fontWeight: '600',
		color: '#4a5568',
		textAlign: 'right',
		writingDirection: 'rtl',
	},
	optionTextSelected: {
		color: '#fff',
	},
	footer: {
		position: 'absolute',
		bottom: 0,
		left: 0,
		right: 0,
		backgroundColor: '#2d3748',
		padding: 20,
		paddingBottom: 30,
		borderTopWidth: 1,
		borderTopColor: '#4a5568',
		shadowColor: '#000',
		shadowOffset: { width: 0, height: -4 },
		shadowOpacity: 0.1,
		shadowRadius: 8,
		elevation: 8,
	},
	submitButton: {
		backgroundColor: '#4a5568',
		paddingVertical: 16,
		borderRadius: 12,
		alignItems: 'center',
		justifyContent: 'center',
		minHeight: 56,
		shadowColor: '#2d3748',
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.3,
		shadowRadius: 8,
		elevation: 5,
	},
	submitButtonDisabled: {
		opacity: 0.6,
	},
	submitButtonText: {
		color: '#fff',
		fontSize: 18,
		fontWeight: '700',
	},
	groupTherapyContainer: {
		backgroundColor: '#f7fafc',
		borderRadius: 16,
		padding: 20,
		marginBottom: 16,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.1,
		shadowRadius: 8,
		elevation: 4,
	},
	groupTherapyCheckbox: {
		flexDirection: 'row',
		alignItems: 'flex-start',
	},
	checkbox: {
		width: 24,
		height: 24,
		borderRadius: 6,
		borderWidth: 2,
		borderColor: '#4a5568',
		backgroundColor: '#fff',
		justifyContent: 'center',
		alignItems: 'center',
		marginLeft: 12,
	},
	checkboxChecked: {
		backgroundColor: '#4a5568',
		borderColor: '#4a5568',
	},
	checkmark: {
		color: '#fff',
		fontSize: 16,
		fontWeight: 'bold',
	},
	groupTherapyTextContainer: {
		flex: 1,
	},
	groupTherapyTitle: {
		fontSize: 16,
		fontWeight: '700',
		color: '#2d3748',
		marginBottom: 4,
		writingDirection: 'rtl',
		textAlign: 'right',
	},
	groupTherapyDescription: {
		fontSize: 14,
		color: '#718096',
		lineHeight: 20,
		writingDirection: 'rtl',
		textAlign: 'right',
	},
});

