module.exports = {
  preset: "jest-expo",
  setupFiles: ["<rootDir>/jest.setup.js"],
  testMatch: ["<rootDir>/src/**/*.test.tsx"],
  testTimeout: 15000,
};
