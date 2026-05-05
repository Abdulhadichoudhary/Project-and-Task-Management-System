function publicDatabaseError(error, fallback) {
  if (error.code === "23505") {
    return { status: 409, message: "Email is already registered." };
  }

  if (error.code === "42P01") {
    return {
      status: 500,
      message: "Database tables are missing. Run npm run db:init, then try again."
    };
  }

  if (error.code === "3D000") {
    return {
      status: 500,
      message: "Database does not exist. Check DATABASE_URL in .env or Railway variables."
    };
  }

  if (["ECONNREFUSED", "ENOTFOUND", "ETIMEDOUT"].includes(error.code)) {
    return {
      status: 500,
      message: "Cannot connect to the database. Check DATABASE_URL and make sure PostgreSQL is running."
    };
  }

  if (!process.env.DATABASE_URL) {
    return {
      status: 500,
      message: "DATABASE_URL is not set. Create a .env file from .env.example and add your PostgreSQL connection string."
    };
  }

  return { status: 500, message: fallback };
}

module.exports = { publicDatabaseError };
