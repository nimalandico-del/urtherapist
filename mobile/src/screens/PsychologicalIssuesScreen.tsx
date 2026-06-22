import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
	SafeAreaView,
	View,
	Text,
	StyleSheet,
	TouchableOpacity,
	ActivityIndicator,
	RefreshControl,
	Dimensions,
	Image,
	Animated,
	ScrollView,
} from 'react-native';
import { getPsychologicalIssues, PsychologicalIssue, getWallet, Wallet, getCategories } from '../api/client';
import { getBucketFileUrl } from '../utils/storage';

const { width } = Dimensions.get('window');


const UNCATEGORIZED_KEY = 'uncategorized';
const UNCATEGORIZED_LABEL = 'سایر موارد';

interface CategoryGroup {
	key: string;
	name: string;
	order: number;
	issues: PsychologicalIssue[];
	categoryId?: number | null;
}

interface CategoryTherapistStat {
	therapist_count: number;
	sample_profile_image_url: string | null;
}

interface PsychologicalIssuesScreenProps {
	onIssuePress?: (issueId: number, issueTitle: string) => void;
	navigation?: any;
}

export default function PsychologicalIssuesScreen({ onIssuePress, navigation }: PsychologicalIssuesScreenProps) {
	const [issues, setIssues] = useState<PsychologicalIssue[]>([]);
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
	const [wallet, setWallet] = useState<Wallet | null>(null);
	const [walletError, setWalletError] = useState<string | null>(null);
	const [categoryStats, setCategoryStats] = useState<Record<number, CategoryTherapistStat>>({});
	const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
	const introOpacity = useRef(new Animated.Value(0)).current;
	const headerTranslateY = useRef(new Animated.Value(-18)).current;
	const listTranslateY = useRef(new Animated.Value(26)).current;
	const initialCategoryOpenedRef = useRef(false);

	const categoryGroups = useMemo((): CategoryGroup[] => {
		const groups = new Map<string, CategoryGroup>();

		for (const issue of issues) {
			const key =
				issue.category_id != null
					? `cat-${issue.category_id}`
					: issue.category
						? `name-${issue.category}`
						: UNCATEGORIZED_KEY;
			const name = issue.category || UNCATEGORIZED_LABEL;
			const order = issue.category_order ?? 9999;

			if (!groups.has(key)) {
				groups.set(key, {
					key,
					name,
					order,
					issues: [],
					categoryId: issue.category_id ?? null,
				});
			}
			groups.get(key)!.issues.push(issue);
		}

		for (const group of groups.values()) {
			group.issues.sort(
				(a, b) =>
					(a.order ?? 0) - (b.order ?? 0) ||
					(a.title_fa || a.title).localeCompare(b.title_fa || b.title, 'fa'),
			);
		}

		return Array.from(groups.values()).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'fa'));
	}, [issues]);

	const toggleCategory = (categoryKey: string) => {
		setExpandedCategories((prev) => {
			const next = new Set(prev);
			if (next.has(categoryKey)) {
				next.delete(categoryKey);
			} else {
				next.add(categoryKey);
			}
			return next;
		});
	};

	const handleIssuePress = (issue: PsychologicalIssue) => {
		if (issue.has_form && onIssuePress) {
			onIssuePress(issue.id, issue.title_fa || issue.title || '');
		}
	};

	const getFullImageUrl = (imageUrl: string | null | undefined): string | null => {
		return getBucketFileUrl(imageUrl);
	};

	const loadIssues = async () => {
		try {
			setError(null);
			const data = await getPsychologicalIssues();
			const issuesWithFullUrls = data.map(issue => {
				return {
					...issue,
					image_url: getFullImageUrl(issue.image_url)
				};
			});
			
			console.log('Loaded issues:', issuesWithFullUrls.map(i => ({ 
				title: i.title_fa || i.title, 
				image_url: i.image_url 
			})));
			
			setIssues(issuesWithFullUrls);
		} catch (e: any) {
			setError(e?.response?.data?.detail || 'خطا در بارگذاری مسائل سلامت روان');
			console.error('Error loading issues:', e);
		} finally {
			setLoading(false);
			setRefreshing(false);
		}
	};

	const loadWallet = async () => {
		try {
			setWalletError(null);
			const data = await getWallet();
			setWallet(data);
		} catch (e: any) {
			console.error('Error loading wallet:', e);
			setWalletError('خطا در دریافت کیف پول');
		}
	};

	const loadCategoryStats = async () => {
		try {
			const categories = await getCategories();
			const stats: Record<number, CategoryTherapistStat> = {};
			for (const category of categories) {
				stats[category.id] = {
					therapist_count: category.therapist_count,
					sample_profile_image_url: category.sample_profile_image_url,
				};
			}
			setCategoryStats(stats);
		} catch (e: any) {
			console.error('Error loading category stats:', e);
		}
	};

	useEffect(() => {
		loadIssues();
		loadWallet();
		loadCategoryStats();
	}, []);

	useEffect(() => {
		if (loading) return;

		Animated.parallel([
			Animated.timing(introOpacity, {
				toValue: 1,
				duration: 520,
				useNativeDriver: true,
			}),
			Animated.spring(headerTranslateY, {
				toValue: 0,
				friction: 8,
				tension: 55,
				useNativeDriver: true,
			}),
			Animated.spring(listTranslateY, {
				toValue: 0,
				friction: 9,
				tension: 50,
				useNativeDriver: true,
			}),
		]).start();
	}, [headerTranslateY, introOpacity, listTranslateY, loading]);

	useEffect(() => {
		if (categoryGroups.length === 0 || initialCategoryOpenedRef.current) return;

		initialCategoryOpenedRef.current = true;
		setTimeout(() => {
			setExpandedCategories(new Set([categoryGroups[0].key]));
		}, 260);
	}, [categoryGroups]);

	const onRefresh = () => {
		setRefreshing(true);
		Promise.all([loadIssues(), loadWallet(), loadCategoryStats()]).finally(() => setRefreshing(false));
	};

	const formatRial = (value: number | undefined | null) =>
		new Intl.NumberFormat('fa-IR').format(value || 0);

	if (loading) {
		return (
			<SafeAreaView style={styles.container}>
				<View style={styles.loadingContainer}>
					<ActivityIndicator size="large" color="#4a5568" />
					<Text style={styles.loadingText}>در حال بارگذاری...</Text>
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

			<Animated.View
				style={[
					styles.header,
					{ opacity: introOpacity, transform: [{ translateY: headerTranslateY }] },
				]}
			>
				<View style={styles.headerTop}>
					<Text style={styles.headerTitle}>مسائل سلامت روان</Text>
				</View>
				<View style={styles.walletBar}>
					<Text style={styles.walletLabel}>کیف پول</Text>
					<View style={styles.walletValues}>
						<Text style={styles.walletAmount}>
							موجودی: {formatRial(wallet?.available_balance)} ریال
						</Text>
						<Text style={styles.walletReserved}>
							بلوکه: {formatRial(wallet?.reserved_balance)} ریال
						</Text>
					</View>
				</View>
				{walletError && <Text style={styles.walletError}>{walletError}</Text>}
				<Text style={styles.headerSubtitle}>یک دسته‌بندی را انتخاب کنید</Text>
			</Animated.View>

			{error && (
				<View style={styles.errorContainer}>
					<Text style={styles.errorText}>{error}</Text>
					<TouchableOpacity onPress={loadIssues} style={styles.retryButton}>
						<Text style={styles.retryButtonText}>تلاش مجدد</Text>
					</TouchableOpacity>
				</View>
			)}

			<Animated.ScrollView
				contentContainerStyle={styles.scrollContent}
				style={{ opacity: introOpacity, transform: [{ translateY: listTranslateY }] }}
				showsVerticalScrollIndicator={false}
				refreshControl={
					<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4a5568" />
				}
			>
				{categoryGroups.length === 0 && !error ? (
					<View style={styles.emptyContainer}>
						<Text style={styles.emptyIcon}>📋</Text>
						<Text style={styles.emptyText}>هیچ دسته‌بندی یافت نشد</Text>
					</View>
				) : (
					categoryGroups.map((group) => {
						const isExpanded = expandedCategories.has(group.key);

						return (
							<View key={group.key} style={styles.categorySection}>
								<TouchableOpacity
									style={[styles.categoryCard, isExpanded && styles.categoryCardExpanded]}
									activeOpacity={0.8}
									onPress={() => toggleCategory(group.key)}
								>
									<View style={styles.categoryHeader}>
										<Text style={styles.categoryChevron}>{isExpanded ? '▲' : '▼'}</Text>
										<View style={styles.categoryTitleContainer}>
											<Text style={styles.categoryTitle}>{group.name}</Text>
							{group.categoryId != null && categoryStats[group.categoryId] != null && (
								<Text style={styles.categoryTherapistCount}>
									{categoryStats[group.categoryId].therapist_count} درمانگر
								</Text>
							)}
											<Text style={styles.categoryCount}>
												{group.issues.length} مورد
											</Text>
										</View>
										<View style={styles.categoryIconContainer}>
											<Text style={styles.categoryIcon}>📂</Text>
										</View>
									</View>
								</TouchableOpacity>

								{isExpanded && (
									<AnimatedIssuesList
										issues={group.issues}
										failedImages={failedImages}
										onImageError={(imageUrl) => {
											setFailedImages((prev) => new Set(prev).add(imageUrl));
										}}
										onIssuePress={handleIssuePress}
									/>
								)}
							</View>
						);
					})
				)}
			</Animated.ScrollView>

			{navigation && (
				<View style={styles.bottomNav}>
					<TouchableOpacity
						onPress={() => navigation.navigate('Notifications')}
						style={styles.notificationsButton}
						activeOpacity={0.7}
					>
						<Text style={styles.notificationsButtonIcon}>🔔</Text>
					</TouchableOpacity>
					<TouchableOpacity
						onPress={() => navigation.navigate('Posts')}
						style={styles.postsButton}
						activeOpacity={0.7}
					>
						<Text style={styles.postsButtonIcon}>📝</Text>
					</TouchableOpacity>
					<TouchableOpacity
						onPress={() => navigation.navigate('CameraTest')}
						style={styles.cameraTestButton}
						activeOpacity={0.7}
					>
						<Text style={styles.cameraTestButtonIcon}>📷</Text>
					</TouchableOpacity>
					<TouchableOpacity
						onPress={() => navigation.navigate('Conversations')}
						style={styles.chatButton}
						activeOpacity={0.7}
					>
						<Text style={styles.chatButtonIcon}>💬</Text>
					</TouchableOpacity>
					<TouchableOpacity
						onPress={() => navigation.navigate('SupportChat')}
						style={styles.supportButton}
						activeOpacity={0.7}
					>
						<Text style={styles.supportButtonIcon}>🆘</Text>
					</TouchableOpacity>
					<TouchableOpacity
						onPress={() => navigation.navigate('AcceptedTherapists')}
						style={styles.acceptedTherapistsButton}
						activeOpacity={0.7}
					>
						<Text style={styles.acceptedTherapistsButtonIcon}>✅</Text>
					</TouchableOpacity>
				</View>
			)}
		</SafeAreaView>
	);
}

interface AnimatedIssuesListProps {
	issues: PsychologicalIssue[];
	failedImages: Set<string>;
	onImageError: (imageUrl: string) => void;
	onIssuePress: (issue: PsychologicalIssue) => void;
}

function AnimatedIssuesList({ issues, failedImages, onImageError, onIssuePress }: AnimatedIssuesListProps) {
	const opacity = useRef(new Animated.Value(0)).current;
	const translateY = useRef(new Animated.Value(-10)).current;

	useEffect(() => {
		Animated.parallel([
			Animated.timing(opacity, {
				toValue: 1,
				duration: 260,
				useNativeDriver: true,
			}),
			Animated.spring(translateY, {
				toValue: 0,
				friction: 8,
				tension: 70,
				useNativeDriver: true,
			}),
		]).start();
	}, [opacity, translateY]);

	return (
		<Animated.View style={[styles.issuesList, { opacity, transform: [{ translateY }] }]}>
			{issues.map((issue, index) => (
				<TouchableOpacity
					key={`issue-${issue.id}-${index}`}
					style={[
						styles.issueCard,
						index === issues.length - 1 && styles.issueCardLast,
					]}
					activeOpacity={0.8}
					onPress={() => onIssuePress(issue)}
				>
					<View style={styles.issueHeader}>
						{issue.image_url && !failedImages.has(issue.image_url) ? (
							<Image
								source={{ uri: issue.image_url }}
								style={styles.issueImage}
								resizeMode="cover"
								onError={() => onImageError(issue.image_url!)}
							/>
						) : (
							<View style={styles.issueImagePlaceholder}>
								<Text style={styles.issueIcon}>🧠</Text>
							</View>
						)}
						<View style={styles.issueTitleContainer}>
							<Text style={styles.issueTitle}>{issue.title_fa || issue.title}</Text>
						</View>
					</View>
					{issue.description && (
						<Text style={styles.issueDescription} numberOfLines={2}>
							{issue.description}
						</Text>
					)}
				</TouchableOpacity>
			))}
		</Animated.View>
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
	header: {
		padding: 20,
		paddingTop: 16,
		paddingBottom: 8,
	},
	headerTop: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginBottom: 4,
	},
	headerTitle: {
		fontSize: 28,
		fontWeight: '800',
		color: '#f7fafc',
		textAlign: 'right',
		writingDirection: 'rtl',
		flex: 1,
	},
	headerButtons: {
		flexDirection: 'row',
		alignItems: 'center',
		marginLeft: 12,
		gap: 8,
	},
	bottomNav: {
		position: 'absolute',
		left: 16,
		right: 16,
		bottom: 16,
		flexDirection: 'row',
		justifyContent: 'space-around',
		alignItems: 'center',
		paddingVertical: 10,
		paddingHorizontal: 12,
		borderRadius: 28,
		backgroundColor: 'rgba(26, 32, 44, 0.92)',
		borderWidth: 1,
		borderColor: 'rgba(255, 255, 255, 0.14)',
	},
	cameraTestButton: {
		width: 44,
		height: 44,
		borderRadius: 22,
		backgroundColor: 'rgba(72, 187, 120, 0.3)',
		justifyContent: 'center',
		alignItems: 'center',
	},
	cameraTestButtonIcon: {
		fontSize: 20,
	},
	chatButton: {
		width: 44,
		height: 44,
		borderRadius: 22,
		backgroundColor: 'rgba(255, 255, 255, 0.15)',
		justifyContent: 'center',
		alignItems: 'center',
	},
	chatButtonIcon: {
		fontSize: 20,
	},
	supportButton: {
		width: 44,
		height: 44,
		borderRadius: 22,
		backgroundColor: 'rgba(239, 68, 68, 0.3)',
		justifyContent: 'center',
		alignItems: 'center',
	},
	supportButtonIcon: {
		fontSize: 20,
	},
	acceptedTherapistsButton: {
		width: 44,
		height: 44,
		borderRadius: 22,
		backgroundColor: 'rgba(16, 185, 129, 0.3)',
		justifyContent: 'center',
		alignItems: 'center',
	},
	acceptedTherapistsButtonIcon: {
		fontSize: 20,
	},
	postsButton: {
		width: 44,
		height: 44,
		borderRadius: 22,
		backgroundColor: 'rgba(255, 255, 255, 0.15)',
		justifyContent: 'center',
		alignItems: 'center',
	},
	postsButtonIcon: {
		fontSize: 20,
	},
	notificationsButton: {
		width: 44,
		height: 44,
		borderRadius: 22,
		backgroundColor: 'rgba(255, 193, 7, 0.3)',
		justifyContent: 'center',
		alignItems: 'center',
	},
	notificationsButtonIcon: {
		fontSize: 20,
	},
	walletBar: {
		marginTop: 8,
		padding: 12,
		borderRadius: 12,
		backgroundColor: 'rgba(255, 255, 255, 0.08)',
		borderWidth: 1,
		borderColor: 'rgba(255, 255, 255, 0.15)',
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
	},
	walletLabel: {
		color: '#e2e8f0',
		fontSize: 14,
		fontWeight: '700',
	},
	walletValues: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	walletAmount: {
		color: '#f8fafc',
		fontSize: 14,
		fontWeight: '700',
		marginLeft: 12,
	},
	walletReserved: {
		color: '#cbd5e0',
		fontSize: 13,
		fontWeight: '600',
		marginLeft: 12,
	},
	walletError: {
		color: '#fecaca',
		fontSize: 12,
		marginTop: 6,
	},
	headerSubtitle: {
		fontSize: 14,
		color: '#a0aec0',
		textAlign: 'right',
		writingDirection: 'rtl',
	},
	errorContainer: {
		margin: 20,
		padding: 16,
		backgroundColor: '#f7e8e8',
		borderRadius: 12,
		borderWidth: 1,
		borderColor: '#e2a0a0',
	},
	errorText: {
		fontSize: 14,
		color: '#2d3748',
		textAlign: 'center',
		marginBottom: 12,
		writingDirection: 'rtl',
	},
	retryButton: {
		alignSelf: 'center',
		paddingVertical: 8,
		paddingHorizontal: 16,
		backgroundColor: '#4a5568',
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
		paddingBottom: 104,
	},
	emptyContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		paddingVertical: 60,
	},
	emptyIcon: {
		fontSize: 64,
		marginBottom: 16,
	},
	emptyText: {
		fontSize: 16,
		color: '#a0aec0',
		textAlign: 'center',
		writingDirection: 'rtl',
	},
	categorySection: {
		marginBottom: 12,
	},
	categoryCard: {
		backgroundColor: '#f7fafc',
		borderRadius: 16,
		padding: 16,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.1,
		shadowRadius: 8,
		elevation: 4,
	},
	categoryCardExpanded: {
		borderBottomLeftRadius: 0,
		borderBottomRightRadius: 0,
		marginBottom: 0,
	},
	categoryHeader: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	categoryIconContainer: {
		width: 48,
		height: 48,
		borderRadius: 12,
		backgroundColor: '#e2e8f0',
		justifyContent: 'center',
		alignItems: 'center',
		marginLeft: 12,
	},
	categoryIcon: {
		fontSize: 24,
	},
	categoryTitleContainer: {
		flex: 1,
	},
	categoryTitle: {
		fontSize: 18,
		fontWeight: '700',
		color: '#2d3748',
		writingDirection: 'rtl',
		textAlign: 'right',
		marginBottom: 4,
	},
	categoryMetaRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
	},
	categoryTherapistRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'flex-end',
	},
	categoryTherapistAvatar: {
		width: 32,
		height: 32,
		borderRadius: 16,
		backgroundColor: '#cbd5e0',
		marginRight: 8,
	},
	categoryTherapistAvatarPlaceholder: {
		width: 32,
		height: 32,
		borderRadius: 16,
		backgroundColor: '#cbd5e0',
		justifyContent: 'center',
		alignItems: 'center',
		marginRight: 8,
	},
	categoryTherapistAvatarPlaceholderText: {
		fontSize: 16,
	},
	categoryTherapistCount: {
		fontSize: 12,
		color: '#718096',
		fontWeight: '500',
		writingDirection: 'rtl',
		textAlign: 'right',
	},
	categoryCount: {
		fontSize: 13,
		color: '#718096',
		fontWeight: '500',
		writingDirection: 'rtl',
		textAlign: 'right',
	},
	categoryChevron: {
		fontSize: 14,
		color: '#4a5568',
		marginRight: 8,
		width: 20,
		textAlign: 'center',
	},
	issuesList: {
		backgroundColor: '#edf2f7',
		borderBottomLeftRadius: 16,
		borderBottomRightRadius: 16,
		paddingHorizontal: 12,
		paddingTop: 8,
		paddingBottom: 4,
		borderTopWidth: 1,
		borderTopColor: '#e2e8f0',
	},
	issueCard: {
		backgroundColor: '#f7fafc',
		borderRadius: 12,
		padding: 14,
		marginBottom: 8,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.06,
		shadowRadius: 4,
		elevation: 2,
	},
	issueCardLast: {
		marginBottom: 8,
	},
	issueHeader: {
		flexDirection: 'row',
		alignItems: 'flex-start',
		marginBottom: 12,
	},
	issueImage: {
		width: 48,
		height: 48,
		borderRadius: 10,
		marginLeft: 12,
		backgroundColor: '#e2e8f0',
	},
	issueImagePlaceholder: {
		width: 48,
		height: 48,
		borderRadius: 10,
		marginLeft: 12,
		backgroundColor: '#e2e8f0',
		justifyContent: 'center',
		alignItems: 'center',
	},
	issueIcon: {
		fontSize: 24,
	},
	issueTitleContainer: {
		flex: 1,
	},
	issueTitle: {
		fontSize: 16,
		fontWeight: '600',
		color: '#2d3748',
		writingDirection: 'rtl',
		textAlign: 'right',
	},
	issueDescription: {
		fontSize: 14,
		color: '#4a5568',
		lineHeight: 20,
		writingDirection: 'rtl',
		textAlign: 'right',
	},
});
