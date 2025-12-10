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
export const importGuideFromWord = async (formData) =>
  (await api.post('/guides/import-word', formData, { headers: { 'Content-Type': 'multipart/form-data' } })).data;

// Notes (Info)
export const fetchNotes = async (params = {}) => (await api.get('/notes', { params })).data;
export const createNote = async (payload) => (await api.post('/notes', payload)).data;
export const updateNote = async (id, payload) => (await api.put(`/notes/${id}`, payload)).data;
export const deleteNote = async (id) => api.delete(`/notes/${id}`);

// Data tables
export const fetchTables = async (params = {}) => (await api.get('/tables', { params })).data;
export const fetchTable = async (id) => (await api.get(`/tables/${id}`)).data;
export const createTable = async (payload) => (await api.post('/tables', payload)).data;
export const updateTable = async (id, payload) => (await api.put(`/tables/${id}`, payload)).data;
export const deleteTable = async (id) => api.delete(`/tables/${id}`);

// Favorites
export const fetchFavorites = async (params = {}) => (await api.get('/favorites', { params })).data;
export const createFavorite = async (payload) => (await api.post('/favorites', payload)).data;
export const updateFavorite = async (id, payload) => (await api.put(`/favorites/${id}`, payload)).data;
export const deleteFavorite = async (id) => api.delete(`/favorites/${id}`);
export const importFavorites = async (html) => (await api.post('/favorites/import', { html })).data;

// Tools
export const fetchTools = async (params = {}) => (await api.get('/tools', { params })).data;
export const fetchTool = async (id) => (await api.get(`/tools/${id}`)).data;
export const createTool = async (payload) => (await api.post('/tools', payload)).data;
export const updateTool = async (id, payload) => (await api.put(`/tools/${id}`, payload)).data;
export const deleteTool = async (id) => api.delete(`/tools/${id}`);

// Bot
export const askBot = async (payload) => (await api.post('/bot', payload)).data;
export const askProBot = async (payload) => (await api.post('/chat', payload)).data;
export const fetchChatSessions = async () => (await api.get('/chat/sessions')).data;
export const fetchChatHistory = async (sessionId) => (await api.get(`/chat/${sessionId}/messages`)).data;
export const deleteChatSession = async (sessionId) => api.delete(`/chat/${sessionId}`);
export const rebuildEmbeddings = async () => (await api.post('/embeddings/rebuild')).data;
