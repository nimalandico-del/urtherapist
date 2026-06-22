const PUBLIC_FILE_DOMAIN = 'https://therapylane.ir';

export function getBucketFileUrl(fileUrl: string | null | undefined): string | null {
	if (!fileUrl) return null;

	if (fileUrl.startsWith(PUBLIC_FILE_DOMAIN)) {
		return fileUrl;
	}

	const filePath = fileUrl.startsWith('http://') || fileUrl.startsWith('https://')
		? new URL(fileUrl).pathname
		: fileUrl;
	const cleanPath = filePath.replace(/^\/+/, '').replace(/^therapylane\//, '');

	return `${PUBLIC_FILE_DOMAIN}/${cleanPath}`;
}
