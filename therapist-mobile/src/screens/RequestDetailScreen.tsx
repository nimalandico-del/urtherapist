import React, { useEffect, useState } from 'react';
import {
	SafeAreaView,
	View,
	Text,
	StyleSheet,
	ScrollView,
	TouchableOpacity,
	ActivityIndicator,
	Dimensions,
	Alert,
	TextInput,
} from 'react-native';
import { getSessionRequest, approveSessionRequest, denySessionRequest, submitTherapistOffer, getTherapySessionByRequest, SessionRequest } from '../api/client';

const { width } = Dimensions.get('window');

interface RequestDetailScreenProps {
	route?: {
		params?: {
			requestId: number;
		};
	};
	navigation: any;
}

export default function RequestDetailScreen({ route, navigation }: RequestDetailScreenProps) {
	const [request, setRequest] = useState<SessionRequest | null>(null);
	const [loading, setLoading] = useState(true);
	const [processing, setProcessing] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [offerPrice, setOfferPrice] = useState('');
	const [offerMessage, setOfferMessage] = useState('');

	const requestId = route?.params?.requestId;

	useEffect(() => {
		if (requestId) {
			loadRequestDetails();
		}
	}, [requestId]);

	const loadRequestDetails = async () => {
		if (!requestId) return;
		try {
			setError(null);
			const data = await getSessionRequest(requestId);
			setRequest(data);
		} catch (e: any) {
			setError(e?.response?.data?.detail || 'خطا در بارگذاری جزئیات درخواست');
			console.error('Error loading request details:', e);
		} finally {
			setLoading(false);
		}
	};

	const handleApprove = async () => {
		if (!requestId) return;
		const parsedPrice = Number(offerPrice);
		if (isNaN(parsedPrice) || parsedPrice < 0) {
			Alert.alert('خطا', 'لطفاً یک مبلغ معتبر وارد کنید.');
			return;
		}

		Alert.alert(
			'ارسال پیشنهاد قیمت',
			`آیا می‌خواهید قیمت ${parsedPrice.toLocaleString('fa-IR')} ریال را برای این درخواست ارسال کنید؟`,
			[
				{ text: 'لغو', style: 'cancel' },
				{
					text: 'ارسال',
					onPress: async () => {
						try {
							setProcessing(true);
							const result = await submitTherapistOffer(requestId, parsedPrice, offerMessage.trim());
							setRequest((prev) => {
								if (!prev) return prev;
								return {
									...prev,
									offers: prev.offers ? [result.offer, ...prev.offers] : [result.offer],
								};
							});
							Alert.alert('موفقیت', result.message, [
								{ text: 'باشه', onPress: () => navigation.goBack() },
							]);
						} catch (e: any) {
							Alert.alert('خطا', e?.response?.data?.detail || 'خطا در ارسال پیشنهاد قیمت');
						} finally {
							setProcessing(false);
						}
					},
				},
			]
		);
	};

	const handleDeny = async () => {
		if (!requestId) return;

		Alert.alert(
			'رد درخواست',
			'آیا از رد این درخواست مطمئن هستید؟',
			[
				{ text: 'لغو', style: 'cancel' },
				{
					text: 'رد',
					style: 'destructive',
					onPress: async () => {
						try {
							setProcessing(true);
							const result = await denySessionRequest(requestId);
							setRequest(result.data);
							Alert.alert('موفقیت', result.message, [
								{ text: 'باشه', onPress: () => navigation.goBack() },
							]);
						} catch (e: any) {
							Alert.alert('خطا', e?.response?.data?.detail || 'خطا در رد درخواست');
						} finally {
							setProcessing(false);
						}
					},
				},
			]
		);
	};

	const formatDate = (dateString: string) => {
		const date = new Date(dateString);
		return date.toLocaleDateString('fa-IR', {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
		});
	};

	const getStatusBadge = (status: string) => {
		switch (status) {
			case 'PENDING':
				return { text: 'در انتظار', color: '#f59e0b', bg: '#fef3c7' };
			case 'APPROVED':
				return { text: 'تایید شده', color: '#10b981', bg: '#d1fae5' };
			case 'DENIED':
				return { text: 'رد شده', color: '#ef4444', bg: '#fee2e2' };
			default:
				return { text: status, color: '#6b7280', bg: '#f3f4f6' };
		}
	};

	if (loading) {
		return (
			<SafeAreaView style={styles.container}>
				<View style={styles.loadingContainer}>
					<ActivityIndicator size="large" color="#2563eb" />
					<Text style={styles.loadingText}>در حال بارگذاری...</Text>
				</View>
			</SafeAreaView>
		);
	}

	if (error || !request) {
		return (
			<SafeAreaView style={styles.container}>
				<View style={styles.errorContainer}>
					<Text style={styles.errorText}>{error || 'درخواست یافت نشد'}</Text>
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
				<Text style={styles.headerTitle}>جزئیات درخواست</Text>
			</View>

			<ScrollView
				contentContainerStyle={styles.scrollContent}
				showsVerticalScrollIndicator={false}
			>
				<View style={styles.card}>
					<View style={styles.cardHeader}>
						<Text style={styles.sectionTitle}>اطلاعات درخواست</Text>
						{request.status && (
							<View style={[styles.statusBadge, { backgroundColor: getStatusBadge(request.status).bg }]}>
								<Text style={[styles.statusText, { color: getStatusBadge(request.status).color }]}>
									{getStatusBadge(request.status).text}
								</Text>
							</View>
						)}
					</View>
					
					<View style={styles.infoRow}>
						<Text style={styles.infoLabel}>مسئله روانشناختی:</Text>
						<Text style={styles.infoValue}>
							{request.psychological_issue_title || 'بدون عنوان'}
						</Text>
					</View>

					{request.is_group_therapy && request.patients_count && request.patients_count > 1 ? (
						<>
							<View style={styles.infoRow}>
								<Text style={styles.infoLabel}>نوع درخواست:</Text>
								<Text style={[styles.infoValue, { color: '#2563eb', fontWeight: '700' }]}>
									درمان گروهی ({request.patients_count} بیمار)
								</Text>
							</View>
							<View style={styles.infoRow}>
								<Text style={styles.infoLabel}>تعداد بیماران:</Text>
								<Text style={styles.infoValue}>{request.patients_count} بیمار</Text>
							</View>
						</>
					) : (
						<>
							<View style={styles.infoRow}>
								<Text style={styles.infoLabel}>نام بیمار:</Text>
								<Text style={styles.infoValue}>{request.patient_name || request.patient_phone}</Text>
							</View>
							<View style={styles.infoRow}>
								<Text style={styles.infoLabel}>شماره تماس:</Text>
								<Text style={styles.infoValue}>{request.patient_phone}</Text>
							</View>
						</>
					)}

					<View style={styles.infoRow}>
						<Text style={styles.infoLabel}>تاریخ ثبت:</Text>
						<Text style={styles.infoValue}>{formatDate(request.created_at)}</Text>
					</View>

					{request.status === 'APPROVED' && request.approved_by && (
						<View style={styles.infoRow}>
							<Text style={styles.infoLabel}>تایید شده توسط:</Text>
							<Text style={styles.infoValue}>تراپیست #{request.approved_by}</Text>
						</View>
					)}

					{request.status === 'DENIED' && request.denied_by && (
						<View style={styles.infoRow}>
							<Text style={styles.infoLabel}>رد شده توسط:</Text>
							<Text style={styles.infoValue}>تراپیست #{request.denied_by}</Text>
						</View>
					)}

					{request.status === 'APPROVED' && (request as any).patient_choice === 'ACCEPTED' && (
						<View style={styles.infoRow}>
							<Text style={styles.infoLabel}>وضعیت:</Text>
							<Text style={[styles.infoValue, { color: '#10b981', fontWeight: '700' }]}>
								بیمار تایید کرد - جلسه فعال است
							</Text>
						</View>
					)}
				</View>

				{request.is_group_therapy && request.patients_list && request.patients_list.length > 0 && (
					<View style={styles.card}>
						<Text style={styles.sectionTitle}>لیست بیماران ({request.patients_count || request.patients_list.length} نفر)</Text>
						{request.patients_list.map((patient, index) => (
							<View key={patient.id} style={styles.patientCard}>
								<View style={styles.patientHeader}>
									<View style={styles.patientNumber}>
										<Text style={styles.patientNumberText}>{index + 1}</Text>
									</View>
									<View style={styles.patientInfo}>
										<Text style={styles.patientName}>{patient.name || patient.phone}</Text>
										<Text style={styles.patientPhone}>{patient.phone}</Text>
										{patient.first_name && patient.last_name && (
											<Text style={styles.patientDetails}>
												{patient.first_name} {patient.last_name}
											</Text>
										)}
									</View>
								</View>
							</View>
						))}
					</View>
				)}

				{request.form_response_summary && request.form_response_summary.length > 0 && (
					<View style={styles.card}>
						<Text style={styles.sectionTitle}>خلاصه پاسخ‌های فرم</Text>
						{request.form_response_summary.map((summary, index) => (
							<View key={index} style={styles.summaryItem}>
								<Text style={styles.summaryText}>{summary}</Text>
							</View>
						))}
					</View>
				)}

			{request.status === 'PENDING' && (
				<View style={styles.card}>
					<Text style={styles.sectionTitle}>ارسال پیشنهاد قیمت</Text>
					<View style={styles.inputGroup}>
						<Text style={styles.infoLabel}>قیمت پیشنهادی (ریال):</Text>
						<TextInput
							style={styles.textInput}
							keyboardType='numeric'
							placeholder='مثلاً ۱۰۰۰۰۰'
							placeholderTextColor='#999'
							value={offerPrice}
							onChangeText={setOfferPrice}
						/>
					</View>
					<View style={styles.inputGroup}>
						<Text style={styles.infoLabel}>پیام اضافه (اختیاری):</Text>
						<TextInput
							style={[styles.textInput, styles.textArea]}
							placeholder='می‌توانید توضیح کوتاهی بنویسید'
							placeholderTextColor='#999'
							value={offerMessage}
							onChangeText={setOfferMessage}
							multiline
							numberOfLines={3}
						/>
					</View>
				</View>
			)}
		</ScrollView>

		{request.status === 'PENDING' && (
				<View style={styles.footer}>
					<TouchableOpacity
						style={[styles.actionButton, styles.denyButton]}
						onPress={handleDeny}
						disabled={processing}
					>
						{processing ? (
							<ActivityIndicator color="#fff" size="small" />
						) : (
							<Text style={styles.actionButtonText}>رد درخواست</Text>
						)}
					</TouchableOpacity>
					<TouchableOpacity
						style={[styles.actionButton, styles.approveButton]}
						onPress={handleApprove}
						disabled={processing}
					>
						{processing ? (
							<ActivityIndicator color="#fff" size="small" />
						) : (
							<Text style={styles.actionButtonText}>ارسال پیشنهاد قیمت</Text>
						)}
					</TouchableOpacity>
				</View>
			)}

			{request.status === 'APPROVED' && (request as any).patient_choice === 'ACCEPTED' && (
				<View style={styles.footer}>
					<TouchableOpacity
						style={[styles.actionButton, styles.chatButton]}
						onPress={async () => {
							try {
								const session = await getTherapySessionByRequest(request.id);
								navigation.navigate('Chat', { sessionId: session.id });
							} catch (e: any) {
								Alert.alert('خطا', e?.response?.data?.detail || 'خطا در بارگذاری جلسه');
							}
						}}
					>
						<Text style={styles.actionButtonText}>💬 باز کردن گفتگو</Text>
					</TouchableOpacity>
				</View>
			)}
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
	errorContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		padding: 20,
	},
	errorText: {
		fontSize: 16,
		color: '#ffffff',
		textAlign: 'center',
		marginBottom: 20,
		writingDirection: 'rtl',
	},
	backButton: {
		paddingVertical: 12,
		paddingHorizontal: 24,
		backgroundColor: '#2563eb',
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
		color: '#ffffff',
		fontWeight: 'bold',
	},
	headerTitle: {
		fontSize: 24,
		fontWeight: '800',
		color: '#ffffff',
		textAlign: 'right',
		writingDirection: 'rtl',
		flex: 1,
	},
	scrollContent: {
		padding: 20,
		paddingTop: 8,
		paddingBottom: 100,
	},
	card: {
		backgroundColor: '#ffffff',
		borderRadius: 16,
		padding: 20,
		marginBottom: 16,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.1,
		shadowRadius: 8,
		elevation: 4,
	},
	inputGroup: {
		marginBottom: 16,
	},
	textInput: {
		backgroundColor: '#f8fafc',
		borderRadius: 12,
		borderWidth: 1,
		borderColor: '#e2e8f0',
		paddingHorizontal: 14,
		paddingVertical: 12,
		fontSize: 14,
		color: '#1e3a8a',
		textAlignVertical: 'top',
	},
	textArea: {
		height: 100,
	},
	sectionTitle: {
		fontSize: 20,
		fontWeight: '700',
		color: '#1e3a8a',
		marginBottom: 16,
		writingDirection: 'rtl',
		textAlign: 'right',
	},
	infoRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		marginBottom: 12,
		paddingBottom: 12,
		borderBottomWidth: 1,
		borderBottomColor: '#e2e8f0',
	},
	infoLabel: {
		fontSize: 14,
		fontWeight: '600',
		color: '#64748b',
		writingDirection: 'rtl',
		textAlign: 'right',
		flex: 1,
	},
	infoValue: {
		fontSize: 14,
		color: '#1e3a8a',
		fontWeight: '500',
		writingDirection: 'rtl',
		textAlign: 'left',
		flex: 1,
	},
	responseItem: {
		marginBottom: 20,
		paddingBottom: 16,
		borderBottomWidth: 1,
		borderBottomColor: '#e2e8f0',
	},
	questionText: {
		fontSize: 16,
		fontWeight: '600',
		color: '#1e3a8a',
		marginBottom: 8,
		writingDirection: 'rtl',
		textAlign: 'right',
	},
	answerContainer: {
		backgroundColor: '#f1f5f9',
		borderRadius: 8,
		padding: 12,
		borderLeftWidth: 3,
		borderLeftColor: '#2563eb',
	},
	answerText: {
		fontSize: 14,
		color: '#475569',
		lineHeight: 20,
		writingDirection: 'rtl',
		textAlign: 'right',
	},
	emptyText: {
		fontSize: 14,
		color: '#94a3b8',
		textAlign: 'center',
		writingDirection: 'rtl',
		fontStyle: 'italic',
	},
	cardHeader: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginBottom: 16,
	},
	statusBadge: {
		paddingHorizontal: 12,
		paddingVertical: 6,
		borderRadius: 8,
	},
	statusText: {
		fontSize: 12,
		fontWeight: '600',
	},
	summaryItem: {
		marginBottom: 12,
		padding: 12,
		backgroundColor: '#f1f5f9',
		borderRadius: 8,
		borderLeftWidth: 3,
		borderLeftColor: '#2563eb',
	},
	summaryText: {
		fontSize: 14,
		color: '#475569',
		lineHeight: 20,
		writingDirection: 'rtl',
		textAlign: 'right',
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
		flexDirection: 'row',
		gap: 12,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: -4 },
		shadowOpacity: 0.1,
		shadowRadius: 8,
		elevation: 8,
	},
	actionButton: {
		flex: 1,
		paddingVertical: 16,
		borderRadius: 12,
		alignItems: 'center',
		justifyContent: 'center',
		minHeight: 56,
	},
	approveButton: {
		backgroundColor: '#10b981',
	},
	denyButton: {
		backgroundColor: '#ef4444',
	},
	chatButton: {
		backgroundColor: '#10b981',
	},
	actionButtonText: {
		color: '#fff',
		fontSize: 16,
		fontWeight: '700',
	},
	patientCard: {
		marginBottom: 12,
		padding: 16,
		backgroundColor: '#f8fafc',
		borderRadius: 12,
		borderWidth: 1,
		borderColor: '#e2e8f0',
	},
	patientHeader: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	patientNumber: {
		width: 32,
		height: 32,
		borderRadius: 16,
		backgroundColor: '#2563eb',
		justifyContent: 'center',
		alignItems: 'center',
		marginLeft: 12,
	},
	patientNumberText: {
		color: '#fff',
		fontSize: 14,
		fontWeight: '700',
	},
	patientInfo: {
		flex: 1,
	},
	patientName: {
		fontSize: 16,
		fontWeight: '700',
		color: '#1e3a8a',
		marginBottom: 4,
		writingDirection: 'rtl',
		textAlign: 'right',
	},
	patientPhone: {
		fontSize: 14,
		color: '#64748b',
		marginBottom: 2,
		writingDirection: 'rtl',
		textAlign: 'right',
	},
	patientDetails: {
		fontSize: 13,
		color: '#94a3b8',
		writingDirection: 'rtl',
		textAlign: 'right',
	},
});

