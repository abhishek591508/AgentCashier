import axios from "axios";

const api = axios.create({
  baseURL: "/api/v1",
  headers: { "Content-Type": "application/json" },
});

export const unwrap = (response) => {
  if (!response.data?.success) {
    const error = new Error(response.data?.message || "Request failed");
    error.code = response.data?.code;
    throw error;
  }
  return response.data;
};

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.message || error.message;
    const wrapped = new Error(message);
    wrapped.code = error.response?.data?.code;
    throw wrapped;
  }
);

export default api;
