import bcrypt from "bcrypt";

async function generateHashedPasswords() {
  const adminPassword = await bcrypt.hash("admin123", 10);
  const instructorPassword = await bcrypt.hash("instructor123", 10);
  const studentPassword = await bcrypt.hash("student123", 10);

  console.log("=== Hashed Passwords for Database ===\n");
  console.log("Admin password (admin123):");
  console.log(adminPassword);
  console.log("\nInstructor password (instructor123):");
  console.log(instructorPassword);
  console.log("\nStudent password (student123):");
  console.log(studentPassword);
  console.log("\n=== Copy these to schema.sql ===");
}

generateHashedPasswords();


