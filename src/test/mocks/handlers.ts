import { http, HttpResponse } from 'msw'

export const handlers = [
  // Auth handlers
  http.post('/api/auth/signin', () => {
    return HttpResponse.json({ success: true })
  }),

  http.post('/api/auth/signout', () => {
    return HttpResponse.json({ success: true })
  }),

  // User handlers
  http.get('/api/users/me', () => {
    return HttpResponse.json({
      id: '1',
      email: 'test@example.com',
      name: 'Test User',
      totalXP: 100,
      level: 1,
      currentStreak: 5,
    })
  }),

  // Sparks handlers
  http.get('/api/sparks', () => {
    return HttpResponse.json([
      {
        id: '1',
        title: 'Test Spark',
        description: 'A test spark',
        status: 'SEEDLING',
        xp: 10,
        level: 1,
        userId: '1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ])
  }),

  http.post('/api/sparks', async ({ request }) => {
    const body = await request.json()
    return HttpResponse.json({
      id: '2',
      ...body,
      userId: '1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
  }),

  http.put('/api/sparks/:id', async ({ request, params }) => {
    const body = await request.json()
    return HttpResponse.json({
      id: params.id,
      ...body,
      updatedAt: new Date().toISOString(),
    })
  }),

  http.delete('/api/sparks/:id', ({ params }) => {
    return HttpResponse.json({ id: params.id })
  }),

  // Todos handlers
  http.get('/api/todos', () => {
    return HttpResponse.json([
      {
        id: '1',
        title: 'Test Todo',
        description: 'A test todo',
        completed: false,
        sparkId: '1',
        createdAt: new Date().toISOString(),
      },
    ])
  }),

  http.post('/api/todos', async ({ request }) => {
    const body = await request.json()
    return HttpResponse.json({
      id: '2',
      ...body,
      createdAt: new Date().toISOString(),
    })
  }),
]