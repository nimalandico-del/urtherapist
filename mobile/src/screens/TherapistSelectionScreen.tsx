import React, { useState } from 'react';
import {
	SafeAreaView,
	View,
	Text,
	StyleSheet,
	ScrollView,
	TouchableOpacity,
	ActivityIndicator,
	Alert,
	Dimensions,
	Image,
} from 'react-native';
import { acceptTherapist, rejectTherapist, acceptSessionRequestOffer, rejectSessionRequestOffer } from '../api/client';
import { getBucketFileUrl } from '../utils/storage';

const { width } = Dimensions.get('window');

interface TherapistSelectionScreenProps {
	route: {
		params: {
			sessionRequest: any;
			therapistProfile: any;
			offer?: any;
		};
	};
	navigation: any;
}

function formatPrice(value: number) {
	return `${value.toLocaleString('fa-IR')} ریال`;
}

function getOfferStatusLabel(status: string) {
	switch (status) {
		case 'PENDING':
			return 'در انتظار';
		case 'ACCEPTED':
			return 'تایید شده';
		case 'REJECTED':
			return 'رد شده';
		default:
			return status;
	}
}

export default function TherapistSelectionScreen({ route, navigation }: TherapistSelectionScreenProps) {
	const { sessionRequest, therapistProfile } = route.params;
	const offers = Array.isArray(sessionRequest?.offers) ? sessionRequest.offers : [];
	const [processing, setProcessing] = useState(false);
	const profileImageUrl = getBucketFileUrl(therapistProfile?.profile_image_url);

	if (!therapistProfile) {
		return (
			<SafeAreaView style={styles.container}>
				<View style={styles.errorContainer}>
					<Text style={styles.errorText}>پروفایل تراپیست یافت نشد</Text>
					<TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
						<Text style={styles.backButtonText}>بازگشت</Text>
					</TouchableOpacity>
				</View>
			</SafeAreaView>
		);
	}

	const handleAccept = async () => {
		Alert.alert(
			'تایید تراپیست',
			'آیا می‌خواهید جلسه درمانی را با این تراپیست شروع کنید؟',
			[
				{
					text: 'انصراف',
					style: 'cancel',
				},
				{
					text: 'تایید',
                        onPress: async () => {
                        	try {
                        		setProcessing(true);
                        		// If an offer from this therapist exists, accept that offer (offer workflow)
                        		let offerId: number | null = null;
                        		if (Array.isArray(offers)) {
                        			const match = offers.find(o => o.therapist_id === therapistProfile.user_id || o.therapist_id === therapistProfile.user_id);
                        			if (match) offerId = match.id;
                        		}
                        		if (offerId) {
                        			await acceptSessionRequestOffer(sessionRequest.id, offerId);
                        		} else {
                        			// Fallback to accept_therapist endpoint (for therapist-approved workflow)
                        			await acceptTherapist(sessionRequest.id);
                        		}
                        		// Navigate to chat screen
                        		if (navigation.navigate) {
                        			navigation.navigate('Chat', {
                        				requestId: sessionRequest.id,
                        			});
                        		}
                        	} catch (e: any) {
                        		Alert.alert('خطا', e?.response?.data?.detail || 'خطا در تایید تراپیست');
                        		console.error('Error accepting therapist:', e);
                        	} finally {
                        		setProcessing(false);
                        	}
                        },
				},
			]
		);
	};

	const handleReject = async () => {
		Alert.alert(
			'رد تراپیست',
			'آیا می‌خواهید تراپیست دیگری را انتخاب کنید؟ درخواست شما برای بررسی سایر تراپیست‌ها بازگردانده می‌شود.',
			[
				{
					text: 'انصراف',
					style: 'cancel',
				},
				{
					text: 'تایید',
                        onPress: async () => {
                        	try {
                        		setProcessing(true);
                        		// If an offer from this therapist exists, reject that offer
                        		let offerId: number | null = null;
                        		if (Array.isArray(offers)) {
                        			const match = offers.find(o => o.therapist_id === therapistProfile.user_id || o.therapist_id === therapistProfile.user_id);
                        			if (match) offerId = match.id;
                        		}
                        		if (offerId) {
                        			await rejectSessionRequestOffer(sessionRequest.id, offerId);
                        			Alert.alert('موفقیت', 'پیشنهاد تراپیست رد شد.', [{ text: 'باشه', onPress: () => navigation.goBack() }]);
                        		} else {
                        			// Fallback to reject_therapist endpoint
                        			await rejectTherapist(sessionRequest.id);
                        			Alert.alert('موفقیت', 'درخواست شما برای بررسی سایر تراپیست‌ها بازگردانده شد.', [{ text: 'باشه', onPress: () => navigation.goBack() }]);
                        		}
                        	} catch (e: any) {
                        		Alert.alert('خطا', e?.response?.data?.detail || 'خطا در رد تراپیست');
                        		console.error('Error rejecting therapist:', e);
                        	} finally {
                        		setProcessing(false);
                        	}
                        },
				},
			]
		);
	};

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
				<Text style={styles.headerTitle}>تراپیست تایید شده</Text>
			</View>

			<ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
				<View style={styles.notificationCard}>
					<View style={styles.notificationIcon}>
						<Text style={styles.notificationIconText}>🎉</Text>
					</View>
					<Text style={styles.notificationTitle}>یک تراپیست درخواست شما را تایید کرد</Text>
					<Text style={styles.notificationText}>
						درخواست شما برای مسئله "{sessionRequest.psychological_issue_title}" توسط یک تراپیست تایید شد.
					</Text>
				</View>

				<View style={styles.profileCard}>
					<Text style={styles.sectionTitle}>پروفایل تراپیست</Text>

					{profileImageUrl && (
						<View style={styles.imageContainer}>
							<Image
								source={{ uri: profileImageUrl }}
								style={styles.profileImage}
							/>
						</View>
					)}

					<View style={styles.infoRow}>
						<Text style={styles.label}>نام:</Text>
						<Text style={styles.value}>{therapistProfile.full_name}</Text>
					</View>

					{therapistProfile.bio && (
						<View style={styles.bioContainer}>
							<Text style={styles.label}>بیوگرافی:</Text>
							<Text style={styles.bioText}>{therapistProfile.bio}</Text>
						</View>
					)}

					{therapistProfile.specializations && therapistProfile.specializations.length > 0 && (
						<View style={styles.specializationsContainer}>
							<Text style={styles.label}>تخصص‌ها:</Text>
							<View style={styles.tagsContainer}>
								{therapistProfile.specializations.map((spec: string, index: number) => (
									<View key={index} style={styles.tag}>
										<Text style={styles.tagText}>{spec}</Text>
									</View>
								))}
							</View>
						</View>
					)}

					{therapistProfile.years_of_experience && (
						<View style={styles.infoRow}>
							<Text style={styles.label}>سال‌های تجربه:</Text>
							<Text style={styles.value}>{therapistProfile.years_of_experience} سال</Text>
						</View>
					)}

					{therapistProfile.education && (
						<View style={styles.infoRow}>
							<Text style={styles.label}>تحصیلات:</Text>
							<Text style={styles.value}>{therapistProfile.education}</Text>
						</View>
					)}

					{therapistProfile.certificates && therapistProfile.certificates.length > 0 && (
						<View style={styles.certificatesContainer}>
							<Text style={styles.label}>گواهینامه‌ها:</Text>
							{therapistProfile.certificates.map((cert: string, index: number) => (
								<Text key={index} style={styles.certificateText}>• {cert}</Text>
							))}
						</View>
					)}

					{therapistProfile.city && (
						<View style={styles.infoRow}>
							<Text style={styles.label}>شهر:</Text>
							<Text style={styles.value}>{therapistProfile.city}</Text>
						</View>
					)}

			</View>

			{offers.length > 0 && (
					<View style={styles.offerSummaryCard}>
						<Text style={styles.sectionTitle}>پیشنهادهای تراپیست‌ها</Text>
						{offers.map((offer: any) => (
							<View key={offer.id} style={styles.offerCard}>
								<View style={styles.offerRow}>
									<Text style={styles.offerLabel}>تراپیست:</Text>
									<Text style={styles.offerValue}>{offer.therapist_name || 'تراپیست ناشناس'}</Text>
								</View>
								<View style={styles.offerRow}>
									<Text style={styles.offerLabel}>قیمت:</Text>
									<Text style={styles.offerValue}>{formatPrice(offer.price)}</Text>
								</View>
								{offer.message ? (
									<View style={styles.offerMessageContainer}>
										<Text style={styles.offerMessageLabel}>پیام:</Text>
										<Text style={styles.offerMessageText}>{offer.message}</Text>
									</View>
								) : null}
								<View style={styles.offerRow}>
									<View style={styles.statusBadge}>
										<Text style={styles.statusText}>{getOfferStatusLabel(offer.status)}</Text>
									</View>
								</View>
							</View>
						))}
					</View>
				)}
					</ScrollView>

		<View style={styles.footer}>
			<TouchableOpacity
				style={[styles.actionButton, styles.rejectButton]}
				onPress={handleReject}
					disabled={processing}
				>
					{processing ? (
						<ActivityIndicator color="#fff" size="small" />
					) : (
						<Text style={styles.actionButtonText}>تراپیست دیگری می‌خواهم</Text>
					)}
				</TouchableOpacity>
				<TouchableOpacity
					style={[styles.actionButton, styles.acceptButton]}
					onPress={handleAccept}
					disabled={processing}
				>
					{processing ? (
						<ActivityIndicator color="#fff" size="small" />
					) : (
						<Text style={styles.actionButtonText}>شروع جلسه درمانی</Text>
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
	backButton: {
		paddingVertical: 12,
		paddingHorizontal: 24,
		backgroundColor: '#4a5568',
		borderRadius: 8,
	},
	backButtonText: {
		color: '#fff',
		fontSize: 16,
		fontWeight: '600',
	},
	scrollContent: {
		padding: 20,
		paddingTop: 8,
		paddingBottom: 100,
	},
	notificationCard: {
		backgroundColor: '#dbeafe',
		borderRadius: 16,
		padding: 20,
		marginBottom: 16,
		borderWidth: 2,
		borderColor: '#93c5fd',
	},
	notificationIcon: {
		alignSelf: 'center',
		marginBottom: 12,
	},
	notificationIconText: {
		fontSize: 48,
	},
	notificationTitle: {
		fontSize: 20,
		fontWeight: '700',
		color: '#1e40af',
		textAlign: 'center',
		marginBottom: 8,
		writingDirection: 'rtl',
	},
	notificationText: {
		fontSize: 14,
		color: '#1e3a8a',
		textAlign: 'center',
		writingDirection: 'rtl',
	},
	profileCard: {
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
		writingDirection: 'rtl',
		textAlign: 'right',
	},
	imageContainer: {
		alignItems: 'center',
		marginBottom: 20,
	},
	profileImage: {
		width: 120,
		height: 120,
		borderRadius: 60,
		backgroundColor: '#e2e8f0',
	},
	infoRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginBottom: 12,
		paddingVertical: 8,
		borderBottomWidth: 1,
		borderBottomColor: '#e2e8f0',
	},
	label: {
		fontSize: 14,
		fontWeight: '600',
		color: '#4a5568',
		writingDirection: 'rtl',
		textAlign: 'right',
	},
	value: {
		fontSize: 14,
		color: '#2d3748',
		fontWeight: '500',
		writingDirection: 'rtl',
		textAlign: 'right',
		flex: 1,
		marginLeft: 12,
	},
	bioContainer: {
		marginBottom: 16,
		paddingBottom: 12,
		borderBottomWidth: 1,
		borderBottomColor: '#e2e8f0',
	},
	bioText: {
		fontSize: 14,
		color: '#2d3748',
		lineHeight: 22,
		marginTop: 8,
		writingDirection: 'rtl',
		textAlign: 'right',
	},
	specializationsContainer: {
		marginBottom: 16,
		paddingBottom: 12,
		borderBottomWidth: 1,
		borderBottomColor: '#e2e8f0',
	},
	tagsContainer: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		marginTop: 8,
	},
	tag: {
		backgroundColor: '#dbeafe',
		borderRadius: 8,
		paddingHorizontal: 12,
		paddingVertical: 6,
		marginLeft: 8,
		marginBottom: 8,
	},
	tagText: {
		fontSize: 12,
		color: '#1e40af',
		fontWeight: '600',
	},
	certificatesContainer: {
		marginBottom: 16,
		paddingBottom: 12,
		borderBottomWidth: 1,
		borderBottomColor: '#e2e8f0',
	},
	certificateText: {
		fontSize: 14,
		color: '#2d3748',
		marginTop: 4,
		writingDirection: 'rtl',
		textAlign: 'right',
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
	acceptButton: {
		backgroundColor: '#10b981',
	},
	rejectButton: {
		backgroundColor: '#64748b',
	},
	offerSummaryCard: {
		backgroundColor: '#eff6ff',
		borderRadius: 16,
		padding: 20,
		marginTop: 16,
		borderWidth: 1,
		borderColor: '#bfdbfe',
	},
	offerCard: {
		backgroundColor: '#ffffff',
		borderRadius: 14,
		padding: 14,
		marginBottom: 12,
		borderWidth: 1,
		borderColor: '#e2e8f0',
	},
	offerRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginBottom: 8,
	},
	offerLabel: {
		fontSize: 13,
		fontWeight: '600',
		color: '#475569',
		writingDirection: 'rtl',
		textAlign: 'right',
	},
	offerValue: {
		fontSize: 14,
		fontWeight: '700',
		color: '#1e40af',
		writingDirection: 'rtl',
		textAlign: 'right',
		flex: 1,
		marginLeft: 12,
	},
	offerMessageContainer: {
		marginTop: 8,
		padding: 12,
		backgroundColor: '#f8fafc',
		borderRadius: 12,
	},
	offerMessageLabel: {
		fontSize: 13,
		fontWeight: '600',
		color: '#475569',
		marginBottom: 4,
		writingDirection: 'rtl',
		textAlign: 'right',
	},
	offerMessageText: {
		fontSize: 14,
		color: '#334155',
		lineHeight: 20,
		writingDirection: 'rtl',
		textAlign: 'right',
	},
	statusBadge: {
		alignSelf: 'flex-end',
		backgroundColor: '#e2e8f0',
		borderRadius: 999,
		paddingVertical: 4,
		paddingHorizontal: 10,
	},
	statusText: {
		fontSize: 12,
		fontWeight: '700',
		color: '#1e3a8a',
	},
	actionButtonText: {
		color: '#fff',
		fontSize: 16,
		fontWeight: '700',
	},
});
