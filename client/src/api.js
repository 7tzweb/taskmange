import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
});

// Users
export const fetchUsers = async () => (await api.get('/users')).data;
export const createUser = async (payload) => (await api.post('/users', payload)).data;
export const updateUser = async (id, payload) => (await api.put(`/users/${id}`, payload)).data;
export const deleteUser = async (id) => api.delete(`/users/${id}`);

// Templates
export const fetchTemplates = async () => (await api.get('/templates')).data;
export const createTemplate = async (payload) => (await api.post('/templates', payload)).data;
export const updateTemplate = async (id, payload) => (await api.put(`/templates/${id}`, payload)).data;
export const deleteTemplate = async (id) => api.delete(`/templates/${id}`);

// Tasks
export const fetchTasks = async (params = {}) => (await api.get('/tasks', { params })).data;
export const createTask = async (payload) => (await api.post('/tasks', payload)).data;
export const updateTask = async (id, payload) => (await api.put(`/tasks/${id}`, payload)).data;
export const deleteTask = async (id) => api.delete(`/tasks/${id}`);
export const cloneTask = async (id) => (await api.post(`/tasks/${id}/clone`)).data;

// Categories (Guides)
export const fetchCategories = async () => (await api.get('/categories')).data;
export const createCategory = async (payload) => (await api.post('/categories', payload)).data;
export const updateCategory = async (id, payload) => (await api.put(`/categories/${id}`, payload)).data;
export const deleteCategory = async (id) => api.delete(`/categories/${id}`);

// Guides
export const fetchGuides = async (params = {}) => (await api.get('/guides', { params })).data;
export const createGuide = async (payload) => (await api.post('/guides', payload)).data;
export const updateGuide = async (id, payload) => (await api.put(`/guides/${id}`, payload)).data;
export const deleteGuide = async (id) => api.delete(`/guides/${id}`);
