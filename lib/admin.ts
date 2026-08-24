export function hasAdminPassword(password: unknown) {
  return (
    typeof password === "string" &&
    Boolean(process.env.SKY_UPLOAD_PASSWORD) &&
    password === process.env.SKY_UPLOAD_PASSWORD
  );
}
