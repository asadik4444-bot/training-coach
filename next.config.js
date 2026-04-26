/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  outputFileTracingIncludes: {
    "/api/cron/daily": ["./plan.yml"],
  },
};
