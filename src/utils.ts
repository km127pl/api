const getRandomString = (length: number) => {
	const buffer = new Uint8Array(length);

	crypto.getRandomValues(buffer);
	const code = Array.from(buffer)
		.map((x) => x.toString(16))
		.join('');

	return code;
};

export { getRandomString };
