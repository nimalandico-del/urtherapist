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
	Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
	getCategories,
	getTherapistProfile,
	createOrUpdateTherapistProfile,
	CategoryOption,
	TherapistProfile,
	TherapistProfileUpdateData,
} from '../api/client';

const { width } = Dimensions.get('window');

interface TherapistProfileScreenProps {
	navigation: any;
}

export default function TherapistProfileScreen({ navigation }: TherapistProfileScreenProps) {
	const [profile, setProfile] = useState<TherapistProfile | null>(null);
	const [availableCategories, setAvailableCategories] = useState<CategoryOption[]>([]);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [selectedProfileImage, setSelectedProfileImage] = useState<ImagePicker.ImagePickerAsset | null>(null);

	const [formData, setFormData] = useState<TherapistProfileUpdateData>({
		first_name: '',
		last_name: '',
		bio: '',
		activity_categories: [],
		specializations: [],
		years_of_experience: undefined,
		education: '',
		certificates: [],
		phone: '',
		email: '',
		address: '',
		city: '',
	});

	const [newSpecialization, setNewSpecialization] = useState('');
	const [newCertificate, setNewCertificate] = useState('');

	useEffect(() => {
		loadProfile();
		loadCategories();
	}, []);

	const loadCategories = async () => {
		try {
			const categories = await getCategories();
			setAvailableCategories(categories);
		} catch (e) {
			console.error('Error loading categories:', e);
		}
	};

	const loadProfile = async () => {
		try {
			setLoading(true);
			setError(null);
			const profileData = await getTherapistProfile();
			setProfile(profileData);

			// Initialize form with existing data
			setFormData({
				first_name: profileData.first_name || '',
				last_name: profileData.last_name || '',
				bio: profileData.bio || '',
				activity_categories: profileData.activity_category_ids || [],
				specializations: profileData.specializations || [],
				years_of_experience: profileData.years_of_experience || undefined,
				education: profileData.education || '',
				certificates: profileData.certificates || [],
				phone: profileData.phone || '',
				email: profileData.email || '',
				address: profileData.address || '',
				city: profileData.city || '',
			});
		} catch (e: any) {
			if (e?.response?.status === 404) {
				// Profile doesn't exist yet, that's OK
				setProfile(null);
			} else {
				setError(e?.response?.data?.detail || 'خطا در بارگذاری پروفایل');
				console.error('Error loading profile:', e);
			}
		} finally {
			setLoading(false);
		}
	};

	const addSpecialization = () => {
		if (newSpecialization.trim()) {
			setFormData({
				...formData,
				specializations: [...(formData.specializations || []), newSpecialization.trim()],
			});
			setNewSpecialization('');
		}
	};

	const removeSpecialization = (index: number) => {
		const updated = [...(formData.specializations || [])];
		updated.splice(index, 1);
		setFormData({ ...formData, specializations: updated });
	};

	const addCertificate = () => {
		if (newCertificate.trim()) {
			setFormData({
				...formData,
				certificates: [...(formData.certificates || []), newCertificate.trim()],
			});
			setNewCertificate('');
		}
	};

	const removeCertificate = (index: number) => {
		const updated = [...(formData.certificates || [])];
		updated.splice(index, 1);
		setFormData({ ...formData, certificates: updated });
	};

	const toggleActivityCategory = (categoryId: number) => {
		const selectedCategories = formData.activity_categories || [];
		const updatedCategories = selectedCategories.includes(categoryId)
			? selectedCategories.filter((id) => id !== categoryId)
			: [...selectedCategories, categoryId];
		setFormData({ ...formData, activity_categories: updatedCategories });
	};

	const pickProfileImage = async () => {
		const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
		if (!permission.granted) {
			Alert.alert('خطا', 'برای انتخاب تصویر پروفایل، دسترسی به گالری لازم است');
			return;
		}

		const result = await ImagePicker.launchImageLibraryAsync({
			mediaTypes: ImagePicker.MediaTypeOptions.Images,
			allowsEditing: true,
			aspect: [1, 1],
			quality: 0.85,
		});

		if (!result.canceled && result.assets.length > 0) {
			setSelectedProfileImage(result.assets[0]);
		}
	};

	const getProfileImageFile = () => {
		if (!selectedProfileImage) return undefined;

		const uriParts = selectedProfileImage.uri.split('.');
		const extension = uriParts.length > 1 ? uriParts[uriParts.length - 1] : 'jpg';
		const mimeType = selectedProfileImage.mimeType || `image/${extension === 'jpg' ? 'jpeg' : extension}`;

		return {
			uri: selectedProfileImage.uri,
			name: `therapist-profile-${Date.now()}.${extension}`,
			type: mimeType,
		};
	};

	const handleSave = async () => {
		// Validate required fields
		if (!formData.first_name || !formData.last_name) {
			Alert.alert('خطا', 'لطفاً نام و نام خانوادگی را وارد کنید');
			return;
		}

		try {
			setSaving(true);
			// Clean up empty strings
			const dataToSend: TherapistProfileUpdateData = {
				...formData,
				bio: formData.bio?.trim() || undefined,
				activity_categories: formData.activity_categories?.length ? formData.activity_categories : undefined,
				education: formData.education?.trim() || undefined,
				phone: formData.phone?.trim() || undefined,
				email: formData.email?.trim() || undefined,
				address: formData.address?.trim() || undefined,
				city: formData.city?.trim() || undefined,
				specializations: formData.specializations?.length ? formData.specializations : undefined,
				certificates: formData.certificates?.length ? formData.certificates : undefined,
				profile_image: getProfileImageFile(),
			};

			const updatedProfile = await createOrUpdateTherapistProfile(dataToSend);
			setProfile(updatedProfile);
			setSelectedProfileImage(null);

			Alert.alert(
				'موفقیت',
				updatedProfile.is_approved
					? 'اطلاعات پروفایل با موفقیت ثبت شد'
					: 'اطلاعات پروفایل ثبت شد. منتظر تأیید ادمین باشید.',
				[
					{
						text: 'باشه',
						onPress: () => navigation.goBack(),
					},
				]
			);
		} catch (e: any) {
			const errorData = e?.response?.data;
			const statusCode = e?.response?.status;
			const errorCode = e?.code;
			const errorMessageRaw = e?.message;
			let errorMessage = 'خطا در ثبت اطلاعات. لطفاً دوباره تلاش کنید';

			if (errorData) {
				if (errorData.email) {
					errorMessage = `خطا در ایمیل: ${Array.isArray(errorData.email) ? errorData.email[0] : errorData.email}`;
				} else if (errorData.detail) {
					errorMessage = errorData.detail;
				} else if (typeof errorData === 'object') {
					const firstError = Object.values(errorData)[0];
					errorMessage = Array.isArray(firstError) ? firstError[0] : String(firstError);
				}
			} else if (errorMessageRaw) {
				errorMessage = `خطای شبکه: ${errorMessageRaw}`;
				if (statusCode) {
					errorMessage += `\nstatus: ${statusCode}`;
				}
				if (errorCode) {
					errorMessage += `\ncode: ${errorCode}`;
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
					<ActivityIndicator size="large" color="#2563eb" />
					<Text style={styles.loadingText}>در حال بارگذاری پروفایل...</Text>
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
				<Text style={styles.headerTitle}>پروفایل تراپیست</Text>
			</View>

			{profile && !profile.is_approved && (
				<View style={styles.warningContainer}>
					<Text style={styles.warningText}>
						⚠️ پروفایل شما هنوز توسط ادمین تأیید نشده است. پس از تأیید، پروفایل شما به بیماران نمایش داده می‌شود.
					</Text>
				</View>
			)}

			{error && !profile && (
				<View style={styles.errorContainer}>
					<Text style={styles.errorText}>{error}</Text>
					<TouchableOpacity onPress={loadProfile} style={styles.retryButton}>
						<Text style={styles.retryButtonText}>تلاش مجدد</Text>
					</TouchableOpacity>
				</View>
			)}

			<ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
				<View style={styles.formContainer}>
					<Text style={styles.sectionTitle}>اطلاعات شخصی</Text>

					<View style={styles.profileImageSection}>
						<TouchableOpacity onPress={pickProfileImage} style={styles.profileImageButton} activeOpacity={0.8}>
							{selectedProfileImage?.uri || profile?.profile_image_url ? (
								<Image
									source={{ uri: selectedProfileImage?.uri || profile?.profile_image_url || '' }}
									style={styles.profileImagePreview}
								/>
							) : (
								<View style={styles.profileImagePlaceholder}>
									<Text style={styles.profileImagePlaceholderText}>📷</Text>
								</View>
							)}
						</TouchableOpacity>
						<TouchableOpacity onPress={pickProfileImage} style={styles.chooseImageButton} activeOpacity={0.8}>
							<Text style={styles.chooseImageButtonText}>
								{selectedProfileImage || profile?.profile_image_url ? 'تغییر تصویر پروفایل' : 'انتخاب تصویر پروفایل'}
							</Text>
						</TouchableOpacity>
					</View>

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
						<Text style={styles.label}>بیوگرافی</Text>
						<TextInput
							style={[styles.input, styles.textArea]}
							value={formData.bio || ''}
							onChangeText={(text) => setFormData({ ...formData, bio: text })}
							placeholder="درباره خود بنویسید..."
							placeholderTextColor="#9ca3af"
							multiline
							numberOfLines={4}
							textAlignVertical="top"
							writingDirection="rtl"
							textAlign="right"
						/>
					</View>

					<Text style={styles.sectionTitle}>اطلاعات حرفه‌ای</Text>

					<View style={styles.inputGroup}>
						<Text style={styles.label}>حوزه های فعالیت</Text>
						<Text style={styles.helperText}>دسته‌بندی‌هایی را انتخاب کنید که در آن‌ها فعالیت می‌کنید.</Text>
						<View style={styles.categoryListContainer}>
							{availableCategories.map((category) => {
								const isSelected = (formData.activity_categories || []).includes(category.id);
								return (
									<TouchableOpacity
										key={category.id}
										style={[styles.categoryChip, isSelected && styles.categoryChipSelected]}
										onPress={() => toggleActivityCategory(category.id)}
										activeOpacity={0.8}
									>
										<Text style={[styles.categoryChipText, isSelected && styles.categoryChipTextSelected]}>
											{category.display_name}
										</Text>
									</TouchableOpacity>
								);
							})}
						</View>
					</View>

					<View style={styles.inputGroup}>
						<Text style={styles.label}>تخصص‌ها</Text>
						<View style={styles.listContainer}>
							{formData.specializations?.map((spec, index) => (
								<View key={index} style={styles.tag}>
									<Text style={styles.tagText}>{spec}</Text>
									<TouchableOpacity onPress={() => removeSpecialization(index)} style={styles.tagRemove}>
										<Text style={styles.tagRemoveText}>×</Text>
									</TouchableOpacity>
								</View>
							))}
						</View>
						<View style={styles.addItemContainer}>
							<TextInput
								style={[styles.input, styles.addItemInput]}
								value={newSpecialization}
								onChangeText={setNewSpecialization}
								placeholder="تخصص جدید اضافه کنید"
								placeholderTextColor="#9ca3af"
								writingDirection="rtl"
								textAlign="right"
								onSubmitEditing={addSpecialization}
							/>
							<TouchableOpacity onPress={addSpecialization} style={styles.addButton}>
								<Text style={styles.addButtonText}>+</Text>
							</TouchableOpacity>
						</View>
					</View>

					<View style={styles.inputGroup}>
						<Text style={styles.label}>سال‌های تجربه</Text>
						<TextInput
							style={styles.input}
							value={formData.years_of_experience?.toString() || ''}
							onChangeText={(text) => {
								const num = parseInt(text);
								setFormData({
									...formData,
									years_of_experience: isNaN(num) ? undefined : num,
								});
							}}
							placeholder="0"
							placeholderTextColor="#9ca3af"
							keyboardType="numeric"
							textAlign="left"
						/>
					</View>

					<View style={styles.inputGroup}>
						<Text style={styles.label}>تحصیلات</Text>
						<TextInput
							style={[styles.input, styles.textArea]}
							value={formData.education || ''}
							onChangeText={(text) => setFormData({ ...formData, education: text })}
							placeholder="مدرک تحصیلی و دانشگاه"
							placeholderTextColor="#9ca3af"
							multiline
							numberOfLines={2}
							textAlignVertical="top"
							writingDirection="rtl"
							textAlign="right"
						/>
					</View>

					<View style={styles.inputGroup}>
						<Text style={styles.label}>گواهینامه‌ها</Text>
						<View style={styles.listContainer}>
							{formData.certificates?.map((cert, index) => (
								<View key={index} style={styles.tag}>
									<Text style={styles.tagText}>{cert}</Text>
									<TouchableOpacity onPress={() => removeCertificate(index)} style={styles.tagRemove}>
										<Text style={styles.tagRemoveText}>×</Text>
									</TouchableOpacity>
								</View>
							))}
						</View>
						<View style={styles.addItemContainer}>
							<TextInput
								style={[styles.input, styles.addItemInput]}
								value={newCertificate}
								onChangeText={setNewCertificate}
								placeholder="گواهینامه جدید اضافه کنید"
								placeholderTextColor="#9ca3af"
								writingDirection="rtl"
								textAlign="right"
								onSubmitEditing={addCertificate}
							/>
							<TouchableOpacity onPress={addCertificate} style={styles.addButton}>
								<Text style={styles.addButtonText}>+</Text>
							</TouchableOpacity>
						</View>
					</View>

					<Text style={styles.sectionTitle}>اطلاعات تماس</Text>

					<View style={styles.inputGroup}>
						<Text style={styles.label}>شماره تماس</Text>
						<TextInput
							style={styles.input}
							value={formData.phone || ''}
							onChangeText={(text) => setFormData({ ...formData, phone: text })}
							placeholder="09123456789"
							placeholderTextColor="#9ca3af"
							keyboardType="phone-pad"
							textAlign="left"
						/>
					</View>

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
							placeholder="شهر"
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
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#1e3a8a',
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
		backgroundColor: '#3b82f6',
		opacity: 0.15,
		top: -width * 0.3,
		right: -width * 0.3,
	},
	gradientCircle2: {
		position: 'absolute',
		width: width * 0.8,
		height: width * 0.8,
		borderRadius: width * 0.4,
		backgroundColor: '#60a5fa',
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
		color: '#ffffff',
		writingDirection: 'rtl',
		textAlign: 'center',
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
	errorContainer: {
		margin: 20,
		padding: 16,
		backgroundColor: '#fee2e2',
		borderRadius: 12,
		borderWidth: 1,
		borderColor: '#fca5a5',
	},
	errorText: {
		fontSize: 14,
		color: '#1e3a8a',
		textAlign: 'center',
		marginBottom: 12,
		writingDirection: 'rtl',
	},
	retryButton: {
		alignSelf: 'center',
		paddingVertical: 8,
		paddingHorizontal: 16,
		backgroundColor: '#2563eb',
		borderRadius: 8,
	},
	retryButtonText: {
		color: '#fff',
		fontSize: 14,
		fontWeight: '600',
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
		color: '#1e3a8a',
		marginBottom: 16,
		marginTop: 8,
		writingDirection: 'rtl',
		textAlign: 'right',
	},
	profileImageSection: {
		alignItems: 'center',
		marginBottom: 20,
	},
	profileImageButton: {
		width: 112,
		height: 112,
		borderRadius: 56,
		overflow: 'hidden',
		backgroundColor: '#dbeafe',
		borderWidth: 3,
		borderColor: '#93c5fd',
		marginBottom: 12,
	},
	profileImagePreview: {
		width: '100%',
		height: '100%',
	},
	profileImagePlaceholder: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
	},
	profileImagePlaceholderText: {
		fontSize: 36,
	},
	chooseImageButton: {
		backgroundColor: '#dbeafe',
		borderRadius: 10,
		paddingVertical: 10,
		paddingHorizontal: 16,
	},
	chooseImageButtonText: {
		color: '#1e40af',
		fontSize: 14,
		fontWeight: '700',
		writingDirection: 'rtl',
		textAlign: 'center',
	},
	inputGroup: {
		marginBottom: 16,
	},
	label: {
		fontSize: 14,
		fontWeight: '600',
		color: '#1e40af',
		marginBottom: 8,
		writingDirection: 'rtl',
		textAlign: 'right',
	},
	helperText: {
		fontSize: 13,
		color: '#475569',
		marginBottom: 10,
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
		color: '#1e3a8a',
	},
	textArea: {
		minHeight: 100,
		paddingTop: 16,
	},
	listContainer: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		marginBottom: 8,
	},
	categoryListContainer: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		marginBottom: 4,
	},
	categoryChip: {
		backgroundColor: '#e2e8f0',
		borderWidth: 1,
		borderColor: '#cbd5e1',
		borderRadius: 999,
		paddingVertical: 10,
		paddingHorizontal: 14,
		marginLeft: 8,
		marginBottom: 8,
	},
	categoryChipSelected: {
		backgroundColor: '#2563eb',
		borderColor: '#2563eb',
	},
	categoryChipText: {
		fontSize: 14,
		color: '#1e3a8a',
		writingDirection: 'rtl',
		textAlign: 'center',
	},
	categoryChipTextSelected: {
		color: '#ffffff',
		fontWeight: '700',
	},
	tag: {
		flexDirection: 'row',
		alignItems: 'center',
		backgroundColor: '#dbeafe',
		borderRadius: 8,
		paddingHorizontal: 12,
		paddingVertical: 6,
		marginRight: 8,
		marginBottom: 8,
	},
	tagText: {
		color: '#1e40af',
		fontSize: 14,
		marginLeft: 8,
	},
	tagRemove: {
		width: 20,
		height: 20,
		borderRadius: 10,
		backgroundColor: '#93c5fd',
		justifyContent: 'center',
		alignItems: 'center',
	},
	tagRemoveText: {
		color: '#1e40af',
		fontSize: 16,
		fontWeight: 'bold',
	},
	addItemContainer: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	addItemInput: {
		flex: 1,
		marginRight: 8,
	},
	addButton: {
		width: 48,
		height: 48,
		borderRadius: 12,
		backgroundColor: '#2563eb',
		justifyContent: 'center',
		alignItems: 'center',
	},
	addButtonText: {
		color: '#fff',
		fontSize: 24,
		fontWeight: 'bold',
	},
	footer: {
		position: 'absolute',
		bottom: 0,
		left: 0,
		right: 0,
		backgroundColor: '#1e3a8a',
		padding: 20,
		paddingBottom: 30,
		borderTopWidth: 1,
		borderTopColor: '#3b82f6',
		shadowColor: '#000',
		shadowOffset: { width: 0, height: -4 },
		shadowOpacity: 0.1,
		shadowRadius: 8,
		elevation: 8,
	},
	saveButton: {
		backgroundColor: '#2563eb',
		paddingVertical: 16,
		borderRadius: 12,
		alignItems: 'center',
		justifyContent: 'center',
		minHeight: 56,
		shadowColor: '#1e3a8a',
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
});

