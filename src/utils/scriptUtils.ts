
export interface ScriptInstruction {
  opcode: string;
  data?: string;
}

export interface ScriptState {
  instructions: ScriptInstruction[];
  currentIndex: number;
  stack: string[];
  altStack: string[];
  isComplete: boolean;
  isValid: boolean;
  unlockingScriptLength: number;
}

export const parseScript = (scriptText: string): ScriptInstruction[] => {
  const lines = scriptText.trim().split('\n').filter(line => line.trim() !== '');
  const instructions: ScriptInstruction[] = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed === '') continue;
    
    // Handle hex data (starts with 0x or is all hex)
    if (trimmed.startsWith('0x') || /^[0-9a-fA-F]+$/.test(trimmed)) {
      instructions.push({
        opcode: 'OP_PUSHDATA',
        data: trimmed
      });
    }
    // Handle decimal numbers
    else if (/^\d+$/.test(trimmed)) {
      const num = parseInt(trimmed);
      if (num >= 1 && num <= 16) {
        instructions.push({ opcode: `OP_${num}` });
      } else {
        instructions.push({
          opcode: 'OP_PUSHDATA',
          data: trimmed
        });
      }
    }
    // Handle opcodes
    else {
      instructions.push({ opcode: trimmed.toUpperCase() });
    }
  }
  
  return instructions;
};

export const executeStep = (state: ScriptState): ScriptState => {
  if (state.isComplete || state.currentIndex >= state.instructions.length) {
    return state;
  }
  
  const instruction = state.instructions[state.currentIndex];
  const newStack = [...state.stack];
  const newAltStack = [...state.altStack];
  
  console.log(`Executing: ${instruction.opcode}`, { 
    stackBefore: newStack, 
    altStackBefore: newAltStack 
  });
  
  try {
    switch (instruction.opcode) {
      case 'OP_1':
      case 'OP_TRUE':
        newStack.push('01');
        break;
        
      case 'OP_0':
      case 'OP_FALSE':
        newStack.push('00');
        break;
        
      case 'OP_2':
        newStack.push('02');
        break;
        
      case 'OP_3':
        newStack.push('03');
        break;
        
      case 'OP_4':
        newStack.push('04');
        break;
        
      case 'OP_5':
        newStack.push('05');
        break;
        
      case 'OP_PUSHDATA':
        if (instruction.data) {
          newStack.push(instruction.data);
        }
        break;
        
      case 'OP_DUP':
        if (newStack.length < 1) throw new Error('OP_DUP: Stack underflow');
        newStack.push(newStack[newStack.length - 1]);
        break;
        
      case 'OP_ADD':
        if (newStack.length < 2) throw new Error('OP_ADD: Stack underflow');
        const b = parseInt(newStack.pop() || '0', 16);
        const a = parseInt(newStack.pop() || '0', 16);
        newStack.push((a + b).toString(16).padStart(2, '0'));
        break;
        
      case 'OP_SUB':
        if (newStack.length < 2) throw new Error('OP_SUB: Stack underflow');
        const sub_b = parseInt(newStack.pop() || '0', 16);
        const sub_a = parseInt(newStack.pop() || '0', 16);
        newStack.push((sub_a - sub_b).toString(16).padStart(2, '0'));
        break;
        
      case 'OP_EQUAL':
        if (newStack.length < 2) throw new Error('OP_EQUAL: Stack underflow');
        const eq_b = newStack.pop();
        const eq_a = newStack.pop();
        newStack.push(eq_a === eq_b ? '01' : '00');
        break;
        
      case 'OP_EQUALVERIFY':
        if (newStack.length < 2) throw new Error('OP_EQUALVERIFY: Stack underflow');
        const eqv_b = newStack.pop();
        const eqv_a = newStack.pop();
        if (eqv_a !== eqv_b) throw new Error('OP_EQUALVERIFY: Values not equal');
        break;
        
      case 'OP_HASH160':
        if (newStack.length < 1) throw new Error('OP_HASH160: Stack underflow');
        const hashInput = newStack.pop();
        // Simplified hash - in real implementation this would be RIPEMD160(SHA256(input))
        newStack.push('hash160(' + hashInput + ')');
        break;
        
      case 'OP_CHECKSIG':
        if (newStack.length < 2) throw new Error('OP_CHECKSIG: Stack underflow');
        const pubkey = newStack.pop();
        const signature = newStack.pop();
        // Simplified signature check
        newStack.push('01'); // Assume valid signature for demo
        break;
        
      case 'OP_TOALTSTACK':
        if (newStack.length < 1) throw new Error('OP_TOALTSTACK: Stack underflow');
        newAltStack.push(newStack.pop()!);
        break;
        
      case 'OP_FROMALTSTACK':
        if (newAltStack.length < 1) throw new Error('OP_FROMALTSTACK: Alt stack underflow');
        newStack.push(newAltStack.pop()!);
        break;
        
      default:
        throw new Error(`Unknown opcode: ${instruction.opcode}`);
    }
    
    const nextIndex = state.currentIndex + 1;
    const isComplete = nextIndex >= state.instructions.length;
    
    // Script is valid if it completes and has exactly one truthy value on the stack
    const isValid = isComplete && newStack.length === 1 && newStack[0] !== '00' && newStack[0] !== '';
    
    console.log(`After ${instruction.opcode}:`, { 
      stack: newStack, 
      altStack: newAltStack, 
      isComplete, 
      isValid 
    });
    
    return {
      ...state,
      currentIndex: nextIndex,
      stack: newStack,
      altStack: newAltStack,
      isComplete,
      isValid
    };
  } catch (error) {
    console.error('Execution error:', error);
    throw error;
  }
};
