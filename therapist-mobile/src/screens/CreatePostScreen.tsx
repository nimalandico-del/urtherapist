import React, { useState } from 'react';
import {
	SafeAreaView,
	View,
	Text,
	TextInput,
	StyleSheet,
	TouchableOpacity,
	ActivityIndicator,
	Alert,
	ScrollView,
	Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { createPost } from '../api/client';

interface CreatePostScreenProps {
	navigation: any;
}

export default function CreatePostScreen({ navigation }: CreatePostScreenProps) {
	const [postType, setPostType] = useState<'TEXT' | 'IMAGE' | 'VIDEO'>('TEXT');
	const [content, setContent] = useState('');
	const [imageUri, setImageUri] = useState<string | null>(null);
	const [videoUri, setVideoUri] = useState<string | null>(null);
	const [creating, setCreating] = useState(false);

	const pickImage = async () => {
		const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
		if (status !== 'granted') {
			Alert.alert('دسترسی مورد نیاز', 'برای انتخاب تصویر نیاز به دسترسی به گالری داریم');
			return;
		}

		const result = await ImagePicker.launchImageLibraryAsync({
			mediaTypes: ImagePicker.MediaTypeOptions.Images,
			allowsEditing: true,
			aspect: [4, 3],
			quality: 0.8,
		});

		if (!result.canceled && result.assets[0]) {
			setImageUri(result.assets[0].uri);
		}
	};

	const pickVideo = async () => {
		const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
		if (status !== 'granted') {
			Alert.alert('دسترسی مورد نیاز', 'برای انتخاب ویدیو نیاز به دسترسی به گالری داریم');
			return;
		}

		const result = await ImagePicker.launchImageLibraryAsync({
			mediaTypes: ImagePicker.MediaTypeOptions.Videos,
			allowsEditing: true,
			quality: 0.8,
		});

		if (!result.canceled && result.assets[0]) {
			setVideoUri(result.assets[0].uri);
		}
	};

	const handleCreate = async () => {
		if (!content.trim()) {
			Alert.alert('خطا', 'لطفاً محتوای پست را وارد کنید');
			return;
		}

		if (postType === 'IMAGE' && !imageUri) {
			Alert.alert('خطا', 'لطفاً یک تصویر انتخاب کنید');
			return;
		}

		if (postType === 'VIDEO' && !videoUri) {
			Alert.alert('خطا', 'لطفاً یک ویدیو انتخاب کنید');
			return;
		}

		setCreating(true);
		try {
			await createPost(postType, content.trim(), imageUri || undefined, videoUri || undefined);
			Alert.alert('موفق', 'پست با موفقیت ایجاد شد', [
				{
					text: 'باشه',
					onPress: () => navigation.goBack(),
				},
			]);
		} catch (error: any) {
			Alert.alert('خطا', error?.response?.data?.detail || 'خطا در ایجاد پست');
		} finally {
			setCreating(false);
		}
	};

	return (
		<SafeAreaView style={styles.container}>
			<View style={styles.header}>
				<TouchableOpacity
					onPress={() => navigation.goBack()}
					style={styles.backButton}
					activeOpacity={0.7}
				>
					<Text style={styles.backButtonText}>← بازگشت</Text>
				</TouchableOpacity>
				<Text style={styles.headerTitle}>ایجاد پست</Text>
				<TouchableOpacity
					onPress={handleCreate}
					style={[styles.createButton, creating && styles.createButtonDisabled]}
					disabled={creating}
					activeOpacity={0.7}
				>
					{creating ? (
						<ActivityIndicator color="#fff" size="small" />
					) : (
						<Text style={styles.createButtonText}>انتشار</Text>
					)}
				</TouchableOpacity>
			</View>

			<ScrollView contentContainerStyle={styles.scrollContent}>
				<View style={styles.typeSelector}>
					<TouchableOpacity
						style={[styles.typeButton, postType === 'TEXT' && styles.typeButtonActive]}
						onPress={() => {
							setPostType('TEXT');
							setImageUri(null);
							setVideoUri(null);
						}}
						activeOpacity={0.7}
					>
						<Text style={[styles.typeButtonText, postType === 'TEXT' && styles.typeButtonTextActive]}>
							📝 متن
						</Text>
					</TouchableOpacity>
					<TouchableOpacity
						style={[styles.typeButton, postType === 'IMAGE' && styles.typeButtonActive]}
						onPress={() => {
							setPostType('IMAGE');
							setVideoUri(null);
						}}
						activeOpacity={0.7}
					>
						<Text style={[styles.typeButtonText, postType === 'IMAGE' && styles.typeButtonTextActive]}>
							🖼️ تصویر
						</Text>
					</TouchableOpacity>
					<TouchableOpacity
						style={[styles.typeButton, postType === 'VIDEO' && styles.typeButtonActive]}
						onPress={() => {
							setPostType('VIDEO');
							setImageUri(null);
						}}
						activeOpacity={0.7}
					>
						<Text style={[styles.typeButtonText, postType === 'VIDEO' && styles.typeButtonTextActive]}>
							🎥 ویدیو
						</Text>
					</TouchableOpacity>
				</View>

				<TextInput
					style={styles.contentInput}
					placeholder="محتوا را بنویسید..."
					placeholderTextColor="#9ca3af"
					value={content}
					onChangeText={setContent}
					multiline
					textAlign="right"
					textAlignVertical="top"
					numberOfLines={8}
				/>

				{postType === 'IMAGE' && (
					<View style={styles.mediaContainer}>
						{imageUri ? (
							<View>
								<Image source={{ uri: imageUri }} style={styles.previewImage} />
								<TouchableOpacity
									style={styles.changeMediaButton}
									onPress={pickImage}
									activeOpacity={0.7}
								>
									<Text style={styles.changeMediaButtonText}>تغییر تصویر</Text>
								</TouchableOpacity>
							</View>
						) : (
							<TouchableOpacity
								style={styles.pickMediaButton}
								onPress={pickImage}
								activeOpacity={0.7}
							>
								<Text style={styles.pickMediaButtonText}>📷 انتخاب تصویر</Text>
							</TouchableOpacity>
						)}
					</View>
				)}

				{postType === 'VIDEO' && (
					<View style={styles.mediaContainer}>
						{videoUri ? (
							<View>
								<View style={styles.videoPreview}>
									<Text style={styles.videoPreviewText}>🎥 ویدیو انتخاب شده</Text>
								</View>
								<TouchableOpacity
									style={styles.changeMediaButton}
									onPress={pickVideo}
									activeOpacity={0.7}
								>
									<Text style={styles.changeMediaButtonText}>تغییر ویدیو</Text>
								</TouchableOpacity>
							</View>
						) : (
							<TouchableOpacity
								style={styles.pickMediaButton}
								onPress={pickVideo}
								activeOpacity={0.7}
							>
								<Text style={styles.pickMediaButtonText}>🎥 انتخاب ویدیو</Text>
							</TouchableOpacity>
						)}
					</View>
				)}
			</ScrollView>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#f9fafb',
	},
	header: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		padding: 16,
		backgroundColor: '#fff',
		borderBottomWidth: 1,
		borderBottomColor: '#e5e7eb',
	},
	backButton: {
		padding: 8,
	},
	backButtonText: {
		fontSize: 16,
		color: '#2563eb',
	},
	headerTitle: {
		fontSize: 18,
		fontWeight: 'bold',
		color: '#111827',
	},
	createButton: {
		backgroundColor: '#2563eb',
		paddingHorizontal: 16,
		paddingVertical: 8,
		borderRadius: 8,
	},
	createButtonDisabled: {
		opacity: 0.6,
	},
	createButtonText: {
		color: '#fff',
		fontSize: 14,
		fontWeight: '600',
	},
	scrollContent: {
		padding: 16,
	},
	typeSelector: {
		flexDirection: 'row',
		marginBottom: 16,
		backgroundColor: '#fff',
		borderRadius: 12,
		padding: 4,
	},
	typeButton: {
		flex: 1,
		paddingVertical: 12,
		alignItems: 'center',
		borderRadius: 8,
	},
	typeButtonActive: {
		backgroundColor: '#2563eb',
	},
	typeButtonText: {
		fontSize: 14,
		color: '#6b7280',
		fontWeight: '600',
	},
	typeButtonTextActive: {
		color: '#fff',
	},
	contentInput: {
		backgroundColor: '#fff',
		borderRadius: 12,
		padding: 16,
		fontSize: 16,
		color: '#111827',
		minHeight: 150,
		textAlign: 'right',
		marginBottom: 16,
	},
	mediaContainer: {
		marginBottom: 16,
	},
	pickMediaButton: {
		backgroundColor: '#fff',
		borderRadius: 12,
		padding: 24,
		alignItems: 'center',
		justifyContent: 'center',
		borderWidth: 2,
		borderColor: '#e5e7eb',
		borderStyle: 'dashed',
	},
	pickMediaButtonText: {
		fontSize: 16,
		color: '#6b7280',
	},
	previewImage: {
		width: '100%',
		height: 200,
		borderRadius: 12,
		marginBottom: 12,
		resizeMode: 'cover',
	},
	videoPreview: {
		width: '100%',
		height: 200,
		borderRadius: 12,
		backgroundColor: '#f3f4f6',
		justifyContent: 'center',
		alignItems: 'center',
		marginBottom: 12,
	},
	videoPreviewText: {
		fontSize: 18,
		color: '#6b7280',
	},
	changeMediaButton: {
		backgroundColor: '#f3f4f6',
		paddingVertical: 12,
		paddingHorizontal: 16,
		borderRadius: 8,
		alignItems: 'center',
	},
	changeMediaButtonText: {
		fontSize: 14,
		color: '#374151',
		fontWeight: '600',
	},
});

