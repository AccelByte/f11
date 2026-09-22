const requiredKeys = [
  'NEXT_PUBLIC_ACCELBYTE_BASE_URL',
  'NEXT_PUBLIC_ACCELBYTE_NAMESPACE',
  'NEXT_PUBLIC_ACCELBYTE_CLIENT_ID',
];

const missingKeys = requiredKeys.filter((key) => !process.env[key]?.trim());

if (missingKeys.length > 0) {
  console.error(`Sites build requires browser-safe AGS configuration: ${missingKeys.join(', ')}`);
  process.exitCode = 1;
}
