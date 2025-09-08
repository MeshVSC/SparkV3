import { ExportService } from './ExportService.js';

// Mock data for testing
const mockSpark = {
  id: '1',
  userId: 'user1',
  title: 'Test Spark',
  description: 'This is a test spark description',
  content: 'This is the content of the spark',
  status: 'SEEDLING',
  xp: 100,
  level: 1,
  color: '#blue',
  tags: 'test, example',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-02'),
  todos: [
    {
      id: 'todo1',
      sparkId: '1',
      title: 'Complete task 1',
      description: 'This is a test todo',
      completed: true,
      type: 'TASK',
      priority: 'HIGH',
      createdAt: new Date('2024-01-01')
    },
    {
      id: 'todo2',
      sparkId: '1',
      title: 'Complete task 2',
      completed: false,
      type: 'TASK',
      priority: 'MEDIUM',
      createdAt: new Date('2024-01-01')
    }
  ]
};

const mockProjectData = {
  projectName: 'Test Project',
  sparks: [mockSpark],
  connections: [
    {
      id: 'conn1',
      sparkId1: '1',
      sparkId2: '2',
      createdAt: new Date('2024-01-01')
    }
  ],
  statistics: {
    totalXP: 100,
    completedTasks: 1
  }
};

// Test function to validate the service
async function testExportService() {
  try {
    console.log('Testing ExportService...');
    
    // Test spark export
    console.log('Testing exportSparkToPDF...');
    const sparkPdf = await ExportService.exportSparkToPDF(mockSpark);
    console.log('✓ Spark PDF generated successfully', sparkPdf instanceof Blob);
    
    // Test project export
    console.log('Testing exportProjectToPDF...');
    const projectPdf = await ExportService.exportProjectToPDF(mockProjectData);
    console.log('✓ Project PDF generated successfully', projectPdf instanceof Blob);
    
    // Test JSON export
    console.log('Testing exportToJSON...');
    const jsonExport = await ExportService.exportToJSON({
      ...mockProjectData,
      user: {
        id: 'user1',
        name: 'Test User',
        email: 'test@example.com',
        totalXP: 100,
        level: 1
      }
    });
    console.log('✓ JSON export successful. Sparks:', jsonExport.sparks.length);
    console.log('  - Export version:', jsonExport.export.version);
    console.log('  - Total connections:', jsonExport.connections.length);
    
    // Validate JSON structure
    if (!jsonExport.export || !jsonExport.sparks || !jsonExport.user) {
      throw new Error('JSON export missing required fields');
    }

    // Test CSV exports
    console.log('Testing CSV exports...');
    
    // Test sparks CSV export
    const sparksCSV = await ExportService.exportSparksToCSV([mockSpark]);
    console.log('✓ Sparks CSV export successful');
    console.log('  - CSV length:', sparksCSV.length);
    console.log('  - Headers included:', sparksCSV.includes('id,title'));
    
    // Test todos CSV export
    const todosCSV = await ExportService.exportTodosToCSV([mockSpark]);
    console.log('✓ Todos CSV export successful');
    console.log('  - CSV length:', todosCSV.length);
    console.log('  - Headers included:', todosCSV.includes('id,title'));
    
    // Test project statistics CSV export
    const statsCSV = await ExportService.exportProjectStatsToCSV(mockProjectData);
    console.log('✓ Project statistics CSV export successful');
    console.log('  - CSV length:', statsCSV.length);
    console.log('  - Headers included:', statsCSV.includes('metric,value'));
    
    // Test custom field selection for sparks
    const customSparksCSV = await ExportService.exportSparksToCSV([mockSpark], ['id', 'title', 'status']);
    console.log('✓ Custom field sparks CSV export successful');
    console.log('  - Custom headers only:', !customSparksCSV.includes('description'));
    
    console.log('All tests passed!');
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Export for potential usage
export { testExportService, mockSpark, mockProjectData };