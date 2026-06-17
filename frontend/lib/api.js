import axios from 'axios';

export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export const api = axios.create({
  baseURL: API_URL,
  timeout: 120000,
});

export function getErrorMessage(error, fallback = 'Something went wrong') {
  return error?.response?.data?.error || error?.response?.data?.message || error?.message || fallback;
}
