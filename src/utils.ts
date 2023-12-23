/**
 * Generate a random string
 * @param length The length of the string (is doubled)
 * @returns A random string
 * @description The length is doubled because the string is generated from a Uint8Array so the length is half of the given length
 */
const getRandomString = (length: number) => {
	const buffer = new Uint8Array(length);

	crypto.getRandomValues(buffer);
	const code = Array.from(buffer)
		.map((x) => x.toString(16))
		.join('');

	return code;
};

export { getRandomString };
