import AsyncStorage from '@react-native-async-storage/async-storage';
import appJson from '../../app.json';

const DEFAULT_BASE: string = (appJson as any)?.expo?.extra?.apiBaseUrl || 'https://9vlx0jwr-8000.euw.devtunnels.ms';
const STORAGE_KEY = 'apiBaseUrlOverride';

export async function getApiBase(): Promise<string> {
  try {
    const v = await AsyncStorage.getItem(STORAGE_KEY);
    return v || DEFAULT_BASE;
  } catch {
    return DEFAULT_BASE;
  }
}

export async function setApiBase(value: string): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, value);
}

export async function clearApiBase(): Promise<void> {
	await AsyncStorage.removeItem(STORAGE_KEY);
}

const TOKEN_KEY = 'accessToken';

export async function getAccessToken(): Promise<string | null> {
	try {
		return await AsyncStorage.getItem(TOKEN_KEY);
	} catch {
		return null;
	}
}

export async function setAccessToken(token: string): Promise<void> {
	await AsyncStorage.setItem(TOKEN_KEY, token);
}

export async function clearAccessToken(): Promise<void> {
	await AsyncStorage.removeItem(TOKEN_KEY);
}



