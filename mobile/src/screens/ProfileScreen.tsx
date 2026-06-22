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
	Modal,
} from 'react-native';
import { getUserProfile, updateUserProfile, UserProfile, UserProfileUpdateData } from '../api/client';
import moment from 'moment-jalaali';

const { width } = Dimensions.get('window');

interface ProfileScreenProps {
	route?: {
		params?: {
			redirectAfterComplete?: boolean;
			returnToForm?: {
				issueId: number;
				issueTitle: string;
			};
		};
	};
	navigation: any;
}

export default function ProfileScreen({ route, navigation }: ProfileScreenProps) {
	const [profile, setProfile] = useState<UserProfile | null>(null);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [showDatePicker, setShowDatePicker] = useState(false);
	const [jalaliDate, setJalaliDate] = useState({ year: 1370, month: 1, day: 1 });
	const [jalaliDisplayText, setJalaliDisplayText] = useState('');
	
	const [formData, setFormData] = useState<UserProfileUpdateData>({
		first_name: '',
		last_name: '',
		date_of_birth: '',
		gender: null,
		email: '',
		address: '',
		city: '',
	});

	const redirectAfterComplete = route?.params?.redirectAfterComplete || false;
	const returnToForm = route?.params?.returnToForm;

	// Convert Gregorian to Jalali for display
	const gregorianToJalali = (gregorianDate: string): { year: number; month: number; day: number } | null => {
		if (!gregorianDate) return null;
		try {
			const m = moment(gregorianDate, 'YYYY-MM-DD');
			if (!m.isValid()) return null;
			const j = m.format('jYYYY/jMM/jDD');
			const [year, month, day] = j.split('/').map(Number);
			return { year, month, day };
		} catch (e) {
			return null;
		}
	};

	// Convert Jalali to Gregorian for API
	const jalaliToGregorian = (year: number, month: number, day: number): string => {
		try {
			const jDateStr = `${year}/${month}/${day}`;
			const m = moment(jDateStr, 'jYYYY/jMM/jDD');
			if (!m.isValid()) return '';
			return m.format('YYYY-MM-DD');
		} catch (e) {
			return '';
		}
	};

	useEffect(() => {
		loadProfile();
	}, []);

	const loadProfile = async () => {
		try {
			setLoading(true);
			setError(null);
			const profileData = await getUserProfile();
			setProfile(profileData);
			
			// Initialize form with existing data
			const dateOfBirth = profileData.date_of_birth || '';
			setFormData({
				first_name: profileData.first_name || '',
				last_name: profileData.last_name || '',
				date_of_birth: dateOfBirth,
				gender: profileData.gender || null,
				email: profileData.email || '',
				address: profileData.address || '',
				city: profileData.city || '',
			});

			// Convert Gregorian to Jalali for display
			if (dateOfBirth) {
				const jalali = gregorianToJalali(dateOfBirth);
				if (jalali) {
					setJalaliDate(jalali);
					setJalaliDisplayText(`${jalali.year}/${String(jalali.month).padStart(2, '0')}/${String(jalali.day).padStart(2, '0')}`);
				}
			}
		} catch (e: any) {
			setError(e?.response?.data?.detail || 'خطا در بارگذاری پروفایل');
			console.error('Error loading profile:', e);
		} finally {
			setLoading(false);
		}
	};

	const openDatePicker = () => {
		// If we have a date, use it; otherwise use a default date (1375-01-01)
		if (formData.date_of_birth) {
			const jalali = gregorianToJalali(formData.date_of_birth);
			if (jalali) {
				setJalaliDate(jalali);
			} else {
				setJalaliDate({ year: 1375, month: 1, day: 1 });
			}
		} else {
			setJalaliDate({ year: 1375, month: 1, day: 1 });
		}
		setShowDatePicker(true);
	};

	const confirmDate = () => {
		const gregorian = jalaliToGregorian(jalaliDate.year, jalaliDate.month, jalaliDate.day);
		if (gregorian) {
			setFormData({ ...formData, date_of_birth: gregorian });
			setJalaliDisplayText(`${jalaliDate.year}/${String(jalaliDate.month).padStart(2, '0')}/${String(jalaliDate.day).padStart(2, '0')}`);
		}
		setShowDatePicker(false);
	};

	const cancelDatePicker = () => {
		setShowDatePicker(false);
	};

	const handleSave = async () => {
		// Validate required fields
		if (!formData.first_name || !formData.last_name || !formData.date_of_birth || !formData.gender) {
			Alert.alert('خطا', 'لطفاً تمام فیلدهای اجباری را پر کنید');
			return;
		}

		// Validate date (check if it's a valid date and not in the future)
		if (formData.date_of_birth) {
			const date = new Date(formData.date_of_birth);
			if (isNaN(date.getTime()) || date > new Date()) {
				Alert.alert('خطا', 'لطفاً یک تاریخ معتبر انتخاب کنید');
				return;
			}
		}

		try {
			setSaving(true);
			// Convert empty strings to null for optional fields
			const dataToSend: UserProfileUpdateData = {
				first_name: formData.first_name || undefined,
				last_name: formData.last_name || undefined,
				date_of_birth: formData.date_of_birth || undefined,
				gender: formData.gender || undefined,
				email: formData.email && formData.email.trim() ? formData.email.trim() : undefined,
				address: formData.address && formData.address.trim() ? formData.address.trim() : undefined,
				city: formData.city && formData.city.trim() ? formData.city.trim() : undefined,
			};

			const updatedProfile = await updateUserProfile(dataToSend);
			setProfile(updatedProfile);
			
			Alert.alert('موفقیت', 'اطلاعات پروفایل با موفقیت ثبت شد', [
				{
					text: 'باشه',
					onPress: () => {
						if (redirectAfterComplete && updatedProfile.is_complete) {
							if (returnToForm) {
								// Navigate back to form
								navigation.navigate('Form', returnToForm);
							} else {
								navigation.goBack();
							}
						} else {
							navigation.goBack();
						}
					},
				},
			]);
		} catch (e: any) {
			const errorData = e?.response?.data;
			let errorMessage = 'خطا در ثبت اطلاعات. لطفاً دوباره تلاش کنید';
			
			if (errorData) {
				if (errorData.email) {
					errorMessage = `خطا در ایمیل: ${Array.isArray(errorData.email) ? errorData.email[0] : errorData.email}`;
				} else if (errorData.date_of_birth) {
					errorMessage = `خطا در تاریخ تولد: ${Array.isArray(errorData.date_of_birth) ? errorData.date_of_birth[0] : errorData.date_of_birth}`;
				} else if (errorData.detail) {
					errorMessage = errorData.detail;
				} else if (typeof errorData === 'object') {
					// Get first error message
					const firstError = Object.values(errorData)[0];
					errorMessage = Array.isArray(firstError) ? firstError[0] : String(firstError);
				}
			}
			
			Alert.alert('خطا', errorMessage);
			console.error('Error saving profile:', e);
		} finally {
			setSaving(false);
		}
	};

	if (loading) {
		return (
			<SafeAreaView style={styles.container}>
				<View style={styles.loadingContainer}>
					<ActivityIndicator size="large" color="#4a5568" />
					<Text style={styles.loadingText}>در حال بارگذاری پروفایل...</Text>
				</View>
			</SafeAreaView>
		);
	}

	if (error && !profile) {
		return (
			<SafeAreaView style={styles.container}>
				<View style={styles.errorContainer}>
					<Text style={styles.errorText}>{error}</Text>
					<TouchableOpacity onPress={loadProfile} style={styles.retryButton}>
						<Text style={styles.retryButtonText}>تلاش مجدد</Text>
					</TouchableOpacity>
					<TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
						<Text style={styles.backButtonText}>بازگشت</Text>
					</TouchableOpacity>
				</View>
			</SafeAreaView>
		);
	}

	const missingFields = profile?.missing_fields || [];

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
				<Text style={styles.headerTitle}>پروفایل کاربری</Text>
			</View>

			{missingFields.length > 0 && (
				<View style={styles.warningContainer}>
					<Text style={styles.warningText}>
						⚠️ لطفاً فیلدهای زیر را تکمیل کنید: {missingFields.join(', ')}
					</Text>
				</View>
			)}

			<ScrollView
				contentContainerStyle={styles.scrollContent}
				showsVerticalScrollIndicator={false}
			>
				<View style={styles.formContainer}>
					<Text style={styles.sectionTitle}>اطلاعات شخصی (اجباری)</Text>
					
					<View style={styles.inputGroup}>
						<Text style={styles.label}>
							نام <Text style={styles.required}>*</Text>
						</Text>
						<TextInput
							style={styles.input}
							value={formData.first_name || ''}
							onChangeText={(text) => setFormData({ ...formData, first_name: text })}
							placeholder="نام خود را وارد کنید"
							placeholderTextColor="#9ca3af"
							writingDirection="rtl"
							textAlign="right"
						/>
					</View>

					<View style={styles.inputGroup}>
						<Text style={styles.label}>
							نام خانوادگی <Text style={styles.required}>*</Text>
						</Text>
						<TextInput
							style={styles.input}
							value={formData.last_name || ''}
							onChangeText={(text) => setFormData({ ...formData, last_name: text })}
							placeholder="نام خانوادگی خود را وارد کنید"
							placeholderTextColor="#9ca3af"
							writingDirection="rtl"
							textAlign="right"
						/>
					</View>

					<View style={styles.inputGroup}>
						<Text style={styles.label}>
							تاریخ تولد <Text style={styles.required}>*</Text>
						</Text>
						<TouchableOpacity onPress={openDatePicker} style={styles.dateInputContainer}>
							<Text style={[styles.dateInputText, !jalaliDisplayText && styles.dateInputPlaceholder]}>
								{jalaliDisplayText || 'تاریخ تولد را انتخاب کنید'}
							</Text>
							<Text style={styles.datePickerIcon}>📅</Text>
						</TouchableOpacity>
					</View>

					<View style={styles.inputGroup}>
						<Text style={styles.label}>
							جنسیت <Text style={styles.required}>*</Text>
						</Text>
						<View style={styles.genderContainer}>
							<TouchableOpacity
								style={[
									styles.genderButton,
									formData.gender === 'M' && styles.genderButtonSelected,
								]}
								onPress={() => setFormData({ ...formData, gender: 'M' })}
							>
								<Text
									style={[
										styles.genderText,
										formData.gender === 'M' && styles.genderTextSelected,
									]}
								>
									مرد
								</Text>
							</TouchableOpacity>
							<TouchableOpacity
								style={[
									styles.genderButton,
									formData.gender === 'F' && styles.genderButtonSelected,
								]}
								onPress={() => setFormData({ ...formData, gender: 'F' })}
							>
								<Text
									style={[
										styles.genderText,
										formData.gender === 'F' && styles.genderTextSelected,
									]}
								>
									زن
								</Text>
							</TouchableOpacity>
							<TouchableOpacity
								style={[
									styles.genderButton,
									formData.gender === 'O' && styles.genderButtonSelected,
								]}
								onPress={() => setFormData({ ...formData, gender: 'O' })}
							>
								<Text
									style={[
										styles.genderText,
										formData.gender === 'O' && styles.genderTextSelected,
									]}
								>
									سایر
								</Text>
							</TouchableOpacity>
						</View>
					</View>

					<Text style={styles.sectionTitle}>اطلاعات تماس (اختیاری)</Text>

					<View style={styles.inputGroup}>
						<Text style={styles.label}>ایمیل</Text>
						<TextInput
							style={styles.input}
							value={formData.email || ''}
							onChangeText={(text) => setFormData({ ...formData, email: text })}
							placeholder="example@email.com"
							placeholderTextColor="#9ca3af"
							keyboardType="email-address"
							autoCapitalize="none"
							textAlign="left"
						/>
					</View>

					<View style={styles.inputGroup}>
						<Text style={styles.label}>شهر</Text>
						<TextInput
							style={styles.input}
							value={formData.city || ''}
							onChangeText={(text) => setFormData({ ...formData, city: text })}
							placeholder="شهر محل سکونت"
							placeholderTextColor="#9ca3af"
							writingDirection="rtl"
							textAlign="right"
						/>
					</View>

					<View style={styles.inputGroup}>
						<Text style={styles.label}>آدرس</Text>
						<TextInput
							style={[styles.input, styles.textArea]}
							value={formData.address || ''}
							onChangeText={(text) => setFormData({ ...formData, address: text })}
							placeholder="آدرس کامل"
							placeholderTextColor="#9ca3af"
							multiline
							numberOfLines={3}
							textAlignVertical="top"
							writingDirection="rtl"
							textAlign="right"
						/>
					</View>
				</View>
			</ScrollView>

			<View style={styles.footer}>
				<TouchableOpacity
					style={[styles.saveButton, saving && styles.saveButtonDisabled]}
					onPress={handleSave}
					disabled={saving}
				>
					{saving ? (
						<ActivityIndicator color="#fff" size="small" />
					) : (
						<Text style={styles.saveButtonText}>ذخیره اطلاعات</Text>
					)}
				</TouchableOpacity>
			</View>

			{/* Persian Date Picker Modal */}
			<Modal
				visible={showDatePicker}
				transparent={true}
				animationType="slide"
				onRequestClose={cancelDatePicker}
			>
				<View style={styles.modalOverlay}>
					<View style={styles.modalContent}>
						<Text style={styles.modalTitle}>انتخاب تاریخ تولد (شمسی)</Text>
						
						<View style={styles.datePickerContainer}>
							{/* Year Picker */}
							<View style={styles.pickerColumn}>
								<Text style={styles.pickerLabel}>سال</Text>
								<ScrollView
									style={styles.pickerScroll}
									showsVerticalScrollIndicator={false}
									snapToInterval={50}
									decelerationRate="fast"
								>
									{Array.from({ length: 101 }, (_, i) => 1300 + i).map((year) => (
										<TouchableOpacity
											key={year}
											style={[
												styles.pickerItem,
												jalaliDate.year === year && styles.pickerItemSelected,
											]}
											onPress={() => setJalaliDate({ ...jalaliDate, year })}
										>
											<Text
												style={[
													styles.pickerItemText,
													jalaliDate.year === year && styles.pickerItemTextSelected,
												]}
											>
												{year}
											</Text>
										</TouchableOpacity>
									))}
								</ScrollView>
							</View>

							{/* Month Picker */}
							<View style={styles.pickerColumn}>
								<Text style={styles.pickerLabel}>ماه</Text>
								<ScrollView
									style={styles.pickerScroll}
									showsVerticalScrollIndicator={false}
									snapToInterval={50}
									decelerationRate="fast"
								>
									{Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
										<TouchableOpacity
											key={month}
											style={[
												styles.pickerItem,
												jalaliDate.month === month && styles.pickerItemSelected,
											]}
											onPress={() => setJalaliDate({ ...jalaliDate, month })}
										>
											<Text
												style={[
													styles.pickerItemText,
													jalaliDate.month === month && styles.pickerItemTextSelected,
												]}
											>
												{month}
											</Text>
										</TouchableOpacity>
									))}
								</ScrollView>
							</View>

							{/* Day Picker */}
							<View style={styles.pickerColumn}>
								<Text style={styles.pickerLabel}>روز</Text>
								<ScrollView
									style={styles.pickerScroll}
									showsVerticalScrollIndicator={false}
									snapToInterval={50}
									decelerationRate="fast"
								>
									{Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
										<TouchableOpacity
											key={day}
											style={[
												styles.pickerItem,
												jalaliDate.day === day && styles.pickerItemSelected,
											]}
											onPress={() => setJalaliDate({ ...jalaliDate, day })}
										>
											<Text
												style={[
													styles.pickerItemText,
													jalaliDate.day === day && styles.pickerItemTextSelected,
												]}
											>
												{day}
											</Text>
										</TouchableOpacity>
									))}
								</ScrollView>
							</View>
						</View>

						<View style={styles.modalButtons}>
							<TouchableOpacity
								style={[styles.modalButton, styles.modalButtonCancel]}
								onPress={cancelDatePicker}
							>
								<Text style={styles.modalButtonCancelText}>انصراف</Text>
							</TouchableOpacity>
							<TouchableOpacity
								style={[styles.modalButton, styles.modalButtonConfirm]}
								onPress={confirmDate}
							>
								<Text style={styles.modalButtonConfirmText}>تأیید</Text>
							</TouchableOpacity>
						</View>
					</View>
				</View>
			</Modal>
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
	headerTitle: {
		fontSize: 24,
		fontWeight: '800',
		color: '#f7fafc',
		textAlign: 'right',
		writingDirection: 'rtl',
		flex: 1,
	},
	warningContainer: {
		marginHorizontal: 20,
		marginBottom: 12,
		padding: 12,
		backgroundColor: '#fff3cd',
		borderRadius: 8,
		borderWidth: 1,
		borderColor: '#ffc107',
	},
	warningText: {
		fontSize: 14,
		color: '#856404',
		textAlign: 'right',
		writingDirection: 'rtl',
	},
	scrollContent: {
		padding: 20,
		paddingTop: 8,
		paddingBottom: 100,
	},
	formContainer: {
		backgroundColor: '#f7fafc',
		borderRadius: 16,
		padding: 20,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.1,
		shadowRadius: 8,
		elevation: 4,
	},
	sectionTitle: {
		fontSize: 18,
		fontWeight: '700',
		color: '#2d3748',
		marginBottom: 16,
		marginTop: 8,
		writingDirection: 'rtl',
		textAlign: 'right',
	},
	inputGroup: {
		marginBottom: 16,
	},
	label: {
		fontSize: 14,
		fontWeight: '600',
		color: '#4a5568',
		marginBottom: 8,
		writingDirection: 'rtl',
		textAlign: 'right',
	},
	required: {
		color: '#e53e3e',
	},
	helpText: {
		fontSize: 12,
		color: '#718096',
		marginTop: 4,
		textAlign: 'left',
	},
	input: {
		backgroundColor: '#edf2f7',
		borderWidth: 2,
		borderColor: '#e2e8f0',
		borderRadius: 12,
		padding: 16,
		fontSize: 16,
		color: '#2d3748',
	},
	textArea: {
		minHeight: 100,
		paddingTop: 16,
	},
	genderContainer: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		gap: 12,
	},
	genderButton: {
		flex: 1,
		paddingVertical: 14,
		paddingHorizontal: 20,
		borderRadius: 12,
		backgroundColor: '#edf2f7',
		borderWidth: 2,
		borderColor: '#e2e8f0',
		alignItems: 'center',
	},
	genderButtonSelected: {
		backgroundColor: '#4a5568',
		borderColor: '#4a5568',
	},
	genderText: {
		fontSize: 16,
		fontWeight: '600',
		color: '#4a5568',
	},
	genderTextSelected: {
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
	saveButton: {
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
	saveButtonDisabled: {
		opacity: 0.6,
	},
	saveButtonText: {
		color: '#fff',
		fontSize: 18,
		fontWeight: '700',
	},
	dateInputContainer: {
		backgroundColor: '#edf2f7',
		borderWidth: 2,
		borderColor: '#e2e8f0',
		borderRadius: 12,
		padding: 16,
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
	},
	dateInputText: {
		fontSize: 16,
		color: '#2d3748',
		writingDirection: 'rtl',
		textAlign: 'right',
		flex: 1,
	},
	dateInputPlaceholder: {
		color: '#9ca3af',
	},
	datePickerIcon: {
		fontSize: 20,
		marginLeft: 8,
	},
	modalOverlay: {
		flex: 1,
		backgroundColor: 'rgba(0, 0, 0, 0.5)',
		justifyContent: 'flex-end',
	},
	modalContent: {
		backgroundColor: '#f7fafc',
		borderTopLeftRadius: 20,
		borderTopRightRadius: 20,
		padding: 20,
		paddingBottom: 40,
		maxHeight: '70%',
	},
	modalTitle: {
		fontSize: 20,
		fontWeight: '700',
		color: '#2d3748',
		textAlign: 'center',
		marginBottom: 20,
		writingDirection: 'rtl',
	},
	datePickerContainer: {
		flexDirection: 'row',
		justifyContent: 'space-around',
		height: 200,
		marginBottom: 20,
	},
	pickerColumn: {
		flex: 1,
		alignItems: 'center',
	},
	pickerLabel: {
		fontSize: 14,
		fontWeight: '600',
		color: '#4a5568',
		marginBottom: 8,
		writingDirection: 'rtl',
	},
	pickerScroll: {
		flex: 1,
		width: '100%',
	},
	pickerItem: {
		paddingVertical: 12,
		paddingHorizontal: 16,
		alignItems: 'center',
		justifyContent: 'center',
		minHeight: 50,
	},
	pickerItemSelected: {
		backgroundColor: '#4a5568',
		borderRadius: 8,
	},
	pickerItemText: {
		fontSize: 16,
		color: '#4a5568',
	},
	pickerItemTextSelected: {
		color: '#fff',
		fontWeight: '600',
	},
	modalButtons: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		gap: 12,
		marginTop: 10,
	},
	modalButton: {
		flex: 1,
		paddingVertical: 14,
		borderRadius: 12,
		alignItems: 'center',
		justifyContent: 'center',
	},
	modalButtonCancel: {
		backgroundColor: '#e2e8f0',
	},
	modalButtonConfirm: {
		backgroundColor: '#4a5568',
	},
	modalButtonCancelText: {
		color: '#4a5568',
		fontSize: 16,
		fontWeight: '600',
	},
	modalButtonConfirmText: {
		color: '#fff',
		fontSize: 16,
		fontWeight: '600',
	},
});

