import Papa from 'papaparse';

// Test CSV functionality directly
const mockSpark = {
  id: '1',
  title: 'Test Spark',
  description: 'This is a test spark description',
  status: 'SEEDLING',
  xp: 100,
  level: 1,
  color: '#blue',
  tags: ['test', 'example'],
  positionX: 100,
  positionY: 200,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-02'),
  todos: [
    {
      id: 'todo1',
      title: 'Complete task 1',
      description: 'This is a test todo',
      completed: true,
      type: 'TASK',
      priority: 'HIGH',
      positionX: 50,
      positionY: 75,
      createdAt: new Date('2024-01-01')
    },
    {
      id: 'todo2',
      title: 'Complete task 2',
      completed: false,
      type: 'TASK',
      priority: 'MEDIUM',
      createdAt: new Date('2024-01-01')
    }
  ],
  attachments: [
    { id: 'att1', filename: 'test.pdf', type: 'PDF' }
  ]
};

// Simulate the CSV export functions
function serializeTags(tags) {
  if (!tags) return '';
  
  if (typeof tags === 'string') {
    try {
      const parsed = JSON.parse(tags);
      return Array.isArray(parsed) ? parsed.join(', ') : tags;
    } catch {
      return tags;
    }
  }
  
  if (Array.isArray(tags)) {
    return tags.join(', ');
  }
  
  return String(tags);
}

function exportSparksToCSV(sparks, selectedFields = null) {
  const defaultFields = [
    'id', 'title', 'description', 'status', 'level', 'xp', 
    'color', 'tags', 'positionX', 'positionY', 'createdAt', 
    'updatedAt', 'todoCount', 'completedTodoCount', 'attachmentCount'
  ];

  const fields = selectedFields || defaultFields;

  const csvData = sparks.map(spark => {
    const row = {};

    fields.forEach(field => {
      switch (field) {
        case 'tags':
          row[field] = serializeTags(spark.tags);
          break;
        case 'todoCount':
          row[field] = spark.todos?.length || 0;
          break;
        case 'completedTodoCount':
          row[field] = spark.todos?.filter(todo => todo.completed).length || 0;
          break;
        case 'attachmentCount':
          row[field] = spark.attachments?.length || 0;
          break;
        case 'createdAt':
        case 'updatedAt':
          row[field] = spark[field] ? new Date(spark[field]).toISOString() : '';
          break;
        default:
          row[field] = spark[field] || '';
      }
    });

    return row;
  });

  return Papa.unparse(csvData, {
    header: true,
    delimiter: ',',
    quotes: true,
    skipEmptyLines: true
  });
}

function exportTodosToCSV(sparks, selectedFields = null) {
  const defaultFields = [
    'id', 'title', 'description', 'completed', 'type', 'priority',
    'sparkId', 'sparkTitle', 'positionX', 'positionY', 'createdAt', 'completedAt'
  ];

  const fields = selectedFields || defaultFields;
  const csvData = [];

  sparks.forEach(spark => {
    if (spark.todos && spark.todos.length > 0) {
      spark.todos.forEach(todo => {
        const row = {};

        fields.forEach(field => {
          switch (field) {
            case 'sparkId':
              row[field] = spark.id;
              break;
            case 'sparkTitle':
              row[field] = spark.title;
              break;
            case 'completed':
              row[field] = todo.completed ? 'Yes' : 'No';
              break;
            case 'createdAt':
            case 'completedAt':
              row[field] = todo[field] ? new Date(todo[field]).toISOString() : '';
              break;
            default:
              row[field] = todo[field] || '';
          }
        });

        csvData.push(row);
      });
    }
  });

  return Papa.unparse(csvData, {
    header: true,
    delimiter: ',',
    quotes: true,
    skipEmptyLines: true
  });
}

// Test the functions
console.log('Testing CSV export functions...\n');

console.log('=== SPARKS CSV ===');
const sparksCSV = exportSparksToCSV([mockSpark]);
console.log(sparksCSV);

console.log('\n=== TODOS CSV ===');
const todosCSV = exportTodosToCSV([mockSpark]);
console.log(todosCSV);

console.log('\n=== CUSTOM FIELDS SPARKS CSV ===');
const customSparksCSV = exportSparksToCSV([mockSpark], ['id', 'title', 'status', 'xp', 'tags']);
console.log(customSparksCSV);

console.log('\nAll CSV tests completed successfully!');