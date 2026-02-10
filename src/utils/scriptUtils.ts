import { Script, OP, LockingScript, UnlockingScript, Utils } from '@bsv/sdk';
import Spend from './Spend';

export interface ScriptInstruction {
  opcode: string;
  data?: string;
  rawOpcode?: number;
  pushData?: Uint8Array;
}

export interface ScriptState {
  instructions: ScriptInstruction[];
  currentIndex: number;
  stack: string[];
  altStack: string[];
  isComplete: boolean;
  isValid: boolean;
  unlockingScriptLength: number;
  context: 'UnlockingScript' | 'LockingScript';
  spend?: Spend;  // Internal Spend instance for execution
  isRunning?: boolean;  // Track if in run mode
  breakpoints?: Set<number>;  // Set of instruction indices that are breakpoints
  executionError?: string;  // Store execution error message
  transactionVersion?: number;  // Transaction version (4-byte uint, default 2)
}

const castToBool = (val: Readonly<number[]>): boolean => {
  if (val.length === 0) return false
  for (let i = 0; i < val.length; i++) {
    if (val[i] !== 0) {
      return !(i === val.length - 1 && val[i] === 0x80)
    }
  }
  return false
}

// Helper function to convert Uint8Array to hex string
const uint8ArrayToHex = (arr: Uint8Array): string => {
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
};

// Helper function to convert hex string to Uint8Array
// Accepts both uppercase and lowercase hex, with or without 0x prefix
// Normalizes to lowercase internally
const hexToUint8Array = (hex: string): Uint8Array => {
  const cleanHex = hex.replace(/^0x/i, '').toLowerCase();
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.substr(i, 2), 16);
  }
  return bytes;
};

// Helper function to get opcode name from number
const getOpcodeName = (opcode: number): string => {
  let pushDataUsed = 'OP_PUSH'
  if (opcode > 75) {
    pushDataUsed = `OP_PUSHDATA1`
    if (opcode > 255) {
      pushDataUsed = `OP_PUSHDATA2`
      if (opcode > 65535) {
        pushDataUsed = `OP_PUSHDATA4`
      }
    }
  }
  return OP[opcode] || pushDataUsed
};

export const parseScript = (scriptText: string): ScriptInstruction[] => {
  const lines = scriptText.trim().split(/[\n ]+/).filter(line => line.trim() !== '');
  
  try {
    // First try to use Script.fromASM to get proper chunks
    // Normalize hex values to lowercase since SDK expects lowercase hex
    const normalizedLines = lines.map(line => {
      const trimmed = line.trim();
      // Check if this line contains hex data (with or without 0x prefix)
      if (/^0x/i.test(trimmed) || /^[0-9a-fA-F]+$/.test(trimmed)) {
        return trimmed.replace(/^0x/i, '').toLowerCase();
      }
      return line;
    });
    
    const asmScript = normalizedLines.join(' ');
    console.log('Attempting SDK parsing with normalized ASM:', asmScript);
    const script = Script.fromASM(asmScript);
    
    // Convert script chunks to our instruction format
    const instructions: ScriptInstruction[] = [];
    for (const chunk of script.chunks) {
      const instruction: ScriptInstruction = {
        opcode: getOpcodeName(chunk.op),
        rawOpcode: chunk.op
      };
      
      // Handle data pushes - convert chunk data to hex string
      if (chunk.data && chunk.data.length > 0) {
        instruction.data = Utils.toHex(chunk.data);
        instruction.pushData = Uint8Array.from(chunk.data);
      }
      
      instructions.push(instruction);
    }
    
    console.log('Parsed script using SDK:', { asmScript, instructions });
    return instructions;
  } catch (error) {
    // Fallback to manual parsing if SDK parsing fails
    console.warn('SDK parsing failed, using fallback parser:', error);
    return parseScriptManual(lines);
  }
};

// Fallback manual parsing for cases where SDK parsing fails
const parseScriptManual = (lines: string[]): ScriptInstruction[] => {
  const instructions: ScriptInstruction[] = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed === '') continue;
    
    // Handle hex data (starts with 0x or is all hex, case-insensitive)
    if (/^0x/i.test(trimmed) || /^[0-9a-fA-F]+$/.test(trimmed)) {
      const cleanHex = trimmed.replace(/^0x/i, '').toLowerCase();
      const dataLength = cleanHex.length / 2;
      let opcode: number;
      
      if (dataLength <= 75) {
        opcode = dataLength;
      } else if (dataLength <= 255) {
        opcode = OP.OP_PUSHDATA1;
      } else if (dataLength <= 65535) {
        opcode = OP.OP_PUSHDATA2;
      } else {
        opcode = OP.OP_PUSHDATA4;
      }
      
      instructions.push({
        opcode: getOpcodeName(opcode),
        rawOpcode: opcode,
        data: cleanHex,
        pushData: hexToUint8Array(cleanHex)
      });
    }
    // Handle decimal numbers
    else if (/^-?\d+$/.test(trimmed)) {
      const num = parseInt(trimmed);
      if (num === -1) {
        instructions.push({ opcode: 'OP_1NEGATE', rawOpcode: OP.OP_1NEGATE });
      } else if (num === 0) {
        instructions.push({ opcode: 'OP_0', rawOpcode: OP.OP_0 });
      } else if (num >= 1 && num <= 16) {
        const opcode = OP.OP_1 + (num - 1);
        instructions.push({ opcode: `OP_${num}`, rawOpcode: opcode });
      } else {
        // Convert number to minimal script number encoding
        const scriptNum = encodeScriptNumber(num);
        instructions.push({
          opcode: getOpcodeName(scriptNum.length),
          rawOpcode: scriptNum.length,
          data: uint8ArrayToHex(scriptNum),
          pushData: scriptNum
        });
      }
    }
    // Handle opcodes
    else {
      const opcodeKey = trimmed.toUpperCase();
      const opcodeValue = OP[opcodeKey as keyof typeof OP];
      if (typeof opcodeValue === 'number') {
        instructions.push({ opcode: opcodeKey, rawOpcode: opcodeValue });
      } else {
        throw new Error(`Unknown opcode: ${opcodeKey}`);
      }
    }
  }
  
  return instructions;
};

// Helper function to encode numbers as script numbers
const encodeScriptNumber = (num: number): Uint8Array => {
  if (num === 0) return new Uint8Array(0);
  
  const isNegative = num < 0;
  const absNum = Math.abs(num);
  const bytes: number[] = [];
  
  let value = absNum;
  while (value > 0) {
    bytes.push(value & 0xff);
    value >>= 8;
  }
  
  // If the most significant bit is set, add an extra byte
  if (bytes[bytes.length - 1] & 0x80) {
    bytes.push(isNegative ? 0x80 : 0x00);
  } else if (isNegative) {
    bytes[bytes.length - 1] |= 0x80;
  }
  
  return Uint8Array.from(bytes);
};

// Helper function to decode script numbers
const decodeScriptNumber = (data: Uint8Array): number => {
  if (data.length === 0) return 0;
  
  const bytes = Array.from(data);
  const isNegative = (bytes[bytes.length - 1] & 0x80) !== 0;
  
  let result = 0;
  for (let i = bytes.length - 1; i >= 0; i--) {
    result = result * 256 + (bytes[i] & (i === bytes.length - 1 ? 0x7f : 0xff));
  }
  
  return isNegative ? -result : result;
};

// Helper function to check if data represents true/false
// Accepts both uppercase and lowercase hex
const isTruthy = (data: string): boolean => {
  const normalizedData = data.toLowerCase();
  if (!normalizedData || normalizedData === '00' || normalizedData === '') return false;
  
  // Check if all bytes are zero
  for (let i = 0; i < normalizedData.length; i += 2) {
    const byte = parseInt(normalizedData.substr(i, 2), 16);
    if (byte !== 0) {
      // If this is the last byte and it's 0x80 (negative zero), it's still false
      if (i === normalizedData.length - 2 && byte === 0x80) return false;
      return true;
    }
  }
  return false;
};

// Helper function to convert ASM instructions back to Script chunks format
const instructionsToASM = (instructions: ScriptInstruction[]): string => {
  return instructions.map(inst => {
    // If instruction has push data, include it in the ASM
    if (inst.data && inst.data !== '') {
      return inst.data; // Raw hex data will be converted by Script.fromASM
    }
    return inst.opcode;
  }).join(' ');
};

// Helper function to initialize Spend instance from script state  
const createSpendFromState = (state: ScriptState): Spend => {
  // Split instructions into unlocking and locking parts
  const unlockingInstructions = state.instructions.slice(0, state.unlockingScriptLength);
  const lockingInstructions = state.instructions.slice(state.unlockingScriptLength);
  
  // Convert instructions to ASM format for Script.fromASM parsing
  const unlockingASM = instructionsToASM(unlockingInstructions);
  const lockingASM = instructionsToASM(lockingInstructions);
  
  console.log('Creating scripts from ASM:', { unlockingASM, lockingASM });
  
  // Use Script.fromASM to properly parse user input to executable Script chunks
  const unlockingScript = unlockingASM.trim() ? UnlockingScript.fromASM(unlockingASM) : new UnlockingScript([]);
  const lockingScript = lockingASM.trim() ? LockingScript.fromASM(lockingASM) : new LockingScript([]);
  
  console.log('Created scripts with chunks:', {
    unlockingChunks: unlockingScript.chunks.length,
    lockingChunks: lockingScript.chunks.length
  });
  
  // Create a mock Spend instance with minimal required data
  return new Spend({
    sourceTXID: '0000000000000000000000000000000000000000000000000000000000000000',
    sourceOutputIndex: 0,
    sourceSatoshis: 2, // 1 BSV
    lockingScript,
    transactionVersion: state.transactionVersion ?? 2,
    otherInputs: [],
    outputs: [{
      satoshis: 1,
      lockingScript: LockingScript.fromHex('76a914000000000000000000000000000000000000000088ac')
    }],
    unlockingScript,
    inputSequence: 0xffffffff,
    inputIndex: 0,
    lockTime: 0
  });
};

// Helper function to convert number[] to hex string
const numberArrayToHex = (arr: number[]): string => {
  return arr.map(n => n.toString(16).padStart(2, '0')).join('');
};

export const executeStep = (state: ScriptState): ScriptState => {
  if (state.isComplete) {
    return state;
  }
  
  try {
    // Initialize Spend instance if not already created
    if (!state.spend) {
      state.spend = createSpendFromState(state);
    }
    
    const spend = state.spend;
    
    // Execute one step using Spend.step()
    const canContinue = spend.step();
    
    // Convert Spend's internal state back to our ScriptState format
    const newStack = spend.stack.map(numberArrayToHex);
    const newAltStack = spend.altStack.map(numberArrayToHex);
    
    // Determine current context and index
    const newContext = spend.context;
    const newIndex = spend.programCounter + (spend.context === 'LockingScript' ? state.unlockingScriptLength : 0);
    
    // Check if execution is complete
    let isComplete = false;
    let isValid = false;
    
    if (!canContinue || newIndex >= state.instructions.length) {
      isComplete = true;
      // Use Spend's validation logic
      try {
        isValid = castToBool(spend.stack[0])
      } catch (error) {
        console.log('Script validation failed:', error);
        isValid = false;
      }
    }
    
    console.log(`Spend step executed:`, {
      context: newContext,
      programCounter: spend.programCounter,
      stackAfter: newStack,
      altStackAfter: newAltStack,
      isComplete,
      isValid
    });
    
    return {
      ...state,
      currentIndex: newIndex,
      stack: newStack,
      altStack: newAltStack,
      context: newContext,
      isComplete,
      isValid,
      spend,
      executionError: undefined  // Clear any previous error
    };
    
  } catch (error) {
    console.error('Script execution error:', error);
    return {
      ...state,
      isComplete: true,
      isValid: false,
      executionError: error instanceof Error ? error.message : 'Unknown execution error'
    };
  }
};

// Execute script in run mode until completion, error, or breakpoint
export const executeRun = (state: ScriptState): ScriptState => {
  if (state.isComplete) {
    return { ...state, isRunning: false };
  }
  
  let currentState = { ...state, isRunning: true };
  const maxSteps = 10000; // Prevent infinite loops
  let stepCount = 0;
  
  while (!currentState.isComplete && stepCount < maxSteps) {
    // Check if current instruction is a breakpoint (OP_NOP69)
    if (currentState.breakpoints?.has(currentState.currentIndex)) {
      console.log(`Hit breakpoint at instruction ${currentState.currentIndex}`);
      return { ...currentState, isRunning: false };
    }
    
    // Check if current instruction is OP_NOP69 (breakpoint marker)
    const currentInstruction = currentState.instructions[currentState.currentIndex];
    if (currentInstruction && (currentInstruction.opcode === 'OP_NOP69' || currentInstruction.rawOpcode === 69)) {
      console.log(`Hit OP_NOP69 breakpoint at instruction ${currentState.currentIndex}`);
      return { ...currentState, isRunning: false };
    }
    
    try {
      const nextState = executeStep(currentState);
      currentState = { ...nextState, isRunning: true };
      stepCount++;
      
      // If there was an execution error, stop running
      if (currentState.executionError) {
        return { ...currentState, isRunning: false };
      }
    } catch (error) {
      console.error('Error during run execution:', error);
      return {
        ...currentState,
        isComplete: true,
        isValid: false,
        isRunning: false,
        executionError: error instanceof Error ? error.message : 'Unknown execution error'
      };
    }
  }
  
  if (stepCount >= maxSteps) {
    console.warn('Execution stopped due to step limit');
    return {
      ...currentState,
      isComplete: true,
      isValid: false,
      isRunning: false,
      executionError: 'Execution stopped: too many steps (possible infinite loop)'
    };
  }
  
  return { ...currentState, isRunning: false };
};

// Toggle breakpoint at a specific instruction index
export const toggleBreakpoint = (state: ScriptState, instructionIndex: number): ScriptState => {
  const breakpoints = new Set(state.breakpoints || []);
  
  if (breakpoints.has(instructionIndex)) {
    breakpoints.delete(instructionIndex);
  } else {
    breakpoints.add(instructionIndex);
  }
  
  return {
    ...state,
    breakpoints
  };
};

// Check if an instruction is a breakpoint
export const isBreakpoint = (state: ScriptState, instructionIndex: number): boolean => {
  return state.breakpoints?.has(instructionIndex) || 
         (state.instructions[instructionIndex]?.opcode === 'OP_NOP69' || 
          state.instructions[instructionIndex]?.rawOpcode === 69);
};

// Execute script until the next breakpoint from current position
export const executeToNextBreakpoint = (state: ScriptState): ScriptState => {
  if (state.isComplete) {
    return { ...state, isRunning: false };
  }
  
  let currentState = { ...state, isRunning: true };
  const maxSteps = 10000; // Prevent infinite loops
  let stepCount = 0;
  let foundBreakpoint = false;
  
  // First, advance past the current position if we're already at a breakpoint
  if (isBreakpoint(currentState, currentState.currentIndex)) {
    try {
      const nextState = executeStep(currentState);
      currentState = { ...nextState, isRunning: true };
      stepCount++;
      
      if (currentState.executionError || currentState.isComplete) {
        return { ...currentState, isRunning: false };
      }
    } catch (error) {
      return {
        ...currentState,
        isComplete: true,
        isValid: false,
        isRunning: false,
        executionError: error instanceof Error ? error.message : 'Unknown execution error'
      };
    }
  }
  
  // Continue execution until we hit the next breakpoint
  while (!currentState.isComplete && stepCount < maxSteps && !foundBreakpoint) {
    // Check if current instruction is a breakpoint
    if (isBreakpoint(currentState, currentState.currentIndex)) {
      console.log(`Hit next breakpoint at instruction ${currentState.currentIndex}`);
      foundBreakpoint = true;
      break;
    }
    
    try {
      const nextState = executeStep(currentState);
      currentState = { ...nextState, isRunning: true };
      stepCount++;
      
      // If there was an execution error, stop running
      if (currentState.executionError) {
        return { ...currentState, isRunning: false };
      }
    } catch (error) {
      console.error('Error during next breakpoint execution:', error);
      return {
        ...currentState,
        isComplete: true,
        isValid: false,
        isRunning: false,
        executionError: error instanceof Error ? error.message : 'Unknown execution error'
      };
    }
  }
  
  if (stepCount >= maxSteps) {
    console.warn('Execution stopped due to step limit');
    return {
      ...currentState,
      isComplete: true,
      isValid: false,
      isRunning: false,
      executionError: 'Execution stopped: too many steps (possible infinite loop)'
    };
  }
  
  return { ...currentState, isRunning: false };
};

// Find the next breakpoint index from current position
export const findNextBreakpoint = (state: ScriptState): number | null => {
  const startIndex = state.currentIndex + 1;
  
  for (let i = startIndex; i < state.instructions.length; i++) {
    if (isBreakpoint(state, i)) {
      return i;
    }
  }
  
  return null; // No more breakpoints found
};

// Find the previous breakpoint index from current position
export const findPreviousBreakpoint = (state: ScriptState): number | null => {
  const startIndex = state.currentIndex - 1;
  
  for (let i = startIndex; i >= 0; i--) {
    if (isBreakpoint(state, i)) {
      return i;
    }
  }
  
  return null; // No previous breakpoints found
};
