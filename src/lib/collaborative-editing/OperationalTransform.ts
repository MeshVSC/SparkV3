import { Operation, OperationType, TransformedOperation } from '@/types/collaborative-editing';

/**
 * Operational Transformation implementation for collaborative editing
 * Handles conflict resolution when multiple users edit the same content simultaneously
 */
export class OperationalTransform {
  /**
   * Transform operation against another operation to resolve conflicts
   */
  static transform(op1: Operation, op2: Operation): [Operation, Operation] {
    // If operations are on different sparks, no transformation needed
    if (op1.sparkId !== op2.sparkId) {
      return [op1, op2];
    }

    // Handle different operation type combinations
    if (op1.type === OperationType.INSERT && op2.type === OperationType.INSERT) {
      return this.transformInsertInsert(op1, op2);
    }
    
    if (op1.type === OperationType.INSERT && op2.type === OperationType.DELETE) {
      return this.transformInsertDelete(op1, op2);
    }
    
    if (op1.type === OperationType.DELETE && op2.type === OperationType.INSERT) {
      const [transformed2, transformed1] = this.transformInsertDelete(op2, op1);
      return [transformed1, transformed2];
    }
    
    if (op1.type === OperationType.DELETE && op2.type === OperationType.DELETE) {
      return this.transformDeleteDelete(op1, op2);
    }
    
    if (op1.type === OperationType.PROPERTY_UPDATE && op2.type === OperationType.PROPERTY_UPDATE) {
      return this.transformPropertyProperty(op1, op2);
    }

    // Default case: operations don't affect each other
    return [op1, op2];
  }

  /**
   * Transform two insert operations
   */
  private static transformInsertInsert(op1: Operation, op2: Operation): [Operation, Operation] {
    const pos1 = op1.position;
    const pos2 = op2.position;
    const len2 = op2.text?.length || 0;
    const len1 = op1.text?.length || 0;

    if (pos1 < pos2 || (pos1 === pos2 && op1.clientId < op2.clientId)) {
      // op1 comes before op2
      return [
        op1,
        { ...op2, position: pos2 + len1 }
      ];
    } else {
      // op2 comes before op1
      return [
        { ...op1, position: pos1 + len2 },
        op2
      ];
    }
  }

  /**
   * Transform insert operation against delete operation
   */
  private static transformInsertDelete(insertOp: Operation, deleteOp: Operation): [Operation, Operation] {
    const insertPos = insertOp.position;
    const deletePos = deleteOp.position;
    const deleteLen = deleteOp.length || 0;
    const insertLen = insertOp.text?.length || 0;

    if (insertPos <= deletePos) {
      // Insert comes before delete
      return [
        insertOp,
        { ...deleteOp, position: deletePos + insertLen }
      ];
    } else if (insertPos >= deletePos + deleteLen) {
      // Insert comes after delete
      return [
        { ...insertOp, position: insertPos - deleteLen },
        deleteOp
      ];
    } else {
      // Insert is within delete range
      return [
        { ...insertOp, position: deletePos },
        { ...deleteOp, length: deleteLen + insertLen }
      ];
    }
  }

  /**
   * Transform two delete operations
   */
  private static transformDeleteDelete(op1: Operation, op2: Operation): [Operation, Operation] {
    const pos1 = op1.position;
    const pos2 = op2.position;
    const len1 = op1.length || 0;
    const len2 = op2.length || 0;

    if (pos1 + len1 <= pos2) {
      // op1 is completely before op2
      return [
        op1,
        { ...op2, position: pos2 - len1 }
      ];
    } else if (pos2 + len2 <= pos1) {
      // op2 is completely before op1
      return [
        { ...op1, position: pos1 - len2 },
        op2
      ];
    } else {
      // Operations overlap
      const overlapStart = Math.max(pos1, pos2);
      const overlapEnd = Math.min(pos1 + len1, pos2 + len2);
      const overlapLen = overlapEnd - overlapStart;

      return [
        {
          ...op1,
          position: Math.min(pos1, pos2),
          length: len1 - overlapLen
        },
        {
          ...op2,
          position: Math.min(pos1, pos2),
          length: len2 - overlapLen
        }
      ];
    }
  }

  /**
   * Transform two property update operations
   */
  private static transformPropertyProperty(op1: Operation, op2: Operation): [Operation, Operation] {
    if (op1.property === op2.property) {
      // Same property - use timestamp to determine precedence
      if (op1.timestamp > op2.timestamp) {
        return [op1, { ...op2, value: null }]; // op2 is superseded
      } else {
        return [{ ...op1, value: null }, op2]; // op1 is superseded
      }
    }
    
    // Different properties - no conflict
    return [op1, op2];
  }

  /**
   * Transform a list of operations against a single operation
   */
  static transformMany(operations: Operation[], against: Operation): Operation[] {
    return operations.map(op => {
      const [transformed] = this.transform(op, against);
      return transformed;
    });
  }

  /**
   * Compose two operations into one if possible
   */
  static compose(op1: Operation, op2: Operation): Operation | null {
    if (op1.sparkId !== op2.sparkId || op1.userId !== op2.userId) {
      return null;
    }

    // Compose consecutive inserts at the same position
    if (op1.type === OperationType.INSERT && 
        op2.type === OperationType.INSERT && 
        op1.position + (op1.text?.length || 0) === op2.position) {
      return {
        ...op1,
        text: (op1.text || '') + (op2.text || ''),
        timestamp: Math.max(op1.timestamp, op2.timestamp)
      };
    }

    // Compose consecutive deletes at the same position
    if (op1.type === OperationType.DELETE && 
        op2.type === OperationType.DELETE && 
        op1.position === op2.position) {
      return {
        ...op1,
        length: (op1.length || 0) + (op2.length || 0),
        timestamp: Math.max(op1.timestamp, op2.timestamp)
      };
    }

    return null;
  }

  /**
   * Check if two operations can be safely reordered
   */
  static canReorder(op1: Operation, op2: Operation): boolean {
    if (op1.sparkId !== op2.sparkId) return true;
    
    // Property updates on different properties can be reordered
    if (op1.type === OperationType.PROPERTY_UPDATE && 
        op2.type === OperationType.PROPERTY_UPDATE &&
        op1.property !== op2.property) {
      return true;
    }

    // Text operations need careful analysis
    if (op1.type === OperationType.INSERT || op1.type === OperationType.DELETE) {
      if (op2.type === OperationType.INSERT || op2.type === OperationType.DELETE) {
        // Check if operations affect different text ranges
        const op1End = op1.position + (op1.length || op1.text?.length || 0);
        const op2End = op2.position + (op2.length || op2.text?.length || 0);
        
        return op1End <= op2.position || op2End <= op1.position;
      }
    }

    return false;
  }
}