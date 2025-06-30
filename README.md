# BSV Script Wizard Debugger

An interactive Bitcoin Script Interpreter for debugging and visualizing BSV scripts step-by-step. Perfect for developers, educators, and anyone learning about Bitcoin script execution.

## 🚀 Features

- **Step-by-Step Execution**: Debug Bitcoin scripts instruction by instruction
- **Stack Visualization**: Real-time visualization of main stack and alt stack operations
- **Script Sharing**: Share scripts via URL with automatic encoding/decoding
- **Auto-Scrolling**: Automatically scroll to the currently executing instruction
- **BSV SDK Integration**: Uses the official @bsv/sdk for accurate script execution
- **Modern UI**: Clean, responsive interface with dark theme
- **Educational Tool**: Perfect for learning Bitcoin script opcodes and execution flow

## 🎯 How to Use

1. **Enter Scripts**: Input your unlocking script and locking script
2. **Initialize**: Click "Initialize Execution" to prepare the script for debugging
3. **Step Through**: Use "Next Step" to execute instructions one at a time
4. **Monitor Stack**: Watch how the stack changes with each operation
5. **Share**: Use the "Share Script" button to generate a shareable URL

## 📋 Example Scripts

**Simple Addition:**
- Unlocking Script: `OP_1 OP_2`
- Locking Script: `OP_ADD OP_3 OP_EQUAL`

**Signature Verification:**
- Unlocking Script: `304402205d8c27451d4ef462264b9f9781999d220fa1a5b9c5a86fabe6f7a31d95f94a5f022034296b82e9582f5b8542fea7d7cf010f84bec76f6f05e74f5c8acaa235f693ec41`
- Locking Script: `026989c55177f4d406f04ebdfb4884452b4cd927337c0b47cdd82c1a10b8b66f0f OP_CHECKSIG`

CHECKSIGs will not actually evalujate signatures, but rather returns true for any public key and signature.

## 🛠️ Technical Stack

- **Frontend**: React 18 with TypeScript
- **Styling**: Tailwind CSS with shadcn/ui components
- **Bitcoin Library**: @bsv/sdk for script execution
- **Build Tool**: Vite
- **Icons**: Lucide React

## 🏃‍♂️ Development

### Prerequisites
- Node.js 18+ and npm

### Getting Started

```bash
# Clone the repository
git clone https://github.com/sirdeggen/script-wizard-debugger.git

# Navigate to project directory
cd script-wizard-debugger

# Install dependencies
npm install

# Start development server
npm run dev
```

### Build for Production

```bash
# Build the application
npm run build

# Preview the build
npm run preview
```

## 🔧 Key Components

- **ScriptInterpreter**: Main component handling script execution and state management
- **ScriptDisplay**: Visualizes script instructions with execution highlighting
- **StackVisualizer**: Shows real-time stack and alt-stack states
- **URL Utils**: Handles script sharing via URL parameters

## 🎓 Educational Use

This tool is perfect for:
- Learning Bitcoin script opcodes and their behavior
- Understanding stack-based execution model
- Debugging complex script conditions
- Teaching Bitcoin development concepts
- Exploring different script patterns and templates

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues, feature requests, or pull requests.

## 📄 License

This project is open source and available under the OpenBSV license.

## 🔗 Links

- [Live Demo](https://script.brc.dev)
- [BSV SDK Documentation](https://bsv-blockchain.github.io/ts-sdk)
- [Bitcoin Script Reference](https://wiki.bitcoinsv.io/index.php/Script)

---

*Built for the BSV developer community*