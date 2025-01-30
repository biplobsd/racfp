import { glob } from 'glob';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

export async function removeComments(flutterProjectPath) {
  try {
    // Validate input path
    if (!flutterProjectPath) {
      throw new Error('Flutter project path is required');
    }

    const stats = await fs.stat(flutterProjectPath);
    if (!stats.isDirectory()) {
      throw new Error('Provided path is not a directory');
    }

    // Find all Dart files in the Flutter project
    const files = await glob('**/*.dart', { 
      cwd: flutterProjectPath,
      ignore: ['**/build/**', '**/ios/**', '**/android/**', '**/web/**', '**/test/**']
    });

    if (files.length === 0) {
      console.warn('No Dart files found in the specified directory');
      return [];
    }

    const results = [];
    const preservedStrings = [];

    for (const file of files) {
      const filePath = path.join(flutterProjectPath, file);
      let content = await fs.readFile(filePath, 'utf8');
      const originalContent = content;

      // Handle string literals containing comment-like content
      let stringIndex = 0;
      content = content.replace(/(r?"""[\s\S]*?"""|r?'''[\s\S]*?'''|r?'[^'\\]*(?:\\.[^'\\]*)*'|r?"[^"\\]*(?:\\.[^"\\]*)*")/g, match => {
        preservedStrings[stringIndex] = match;
        const placeholder = `PRESERVED_STRING_${stringIndex}`;
        stringIndex++;
        return placeholder;
      });

      // Remove documentation comments (must come before single-line comments)
      content = content.replace(/\/\/\/[^\n]*/g, '');

      // Remove single-line comments (but not URLs in strings)
      content = content.replace(/(?<!:)\/\/[^\n]*/g, '');

      // Remove multi-line comments (handling nested comments)
      let stack = [];
      let lastIndex = 0;
      
      while (true) {
        const startIndex = content.indexOf('/*', lastIndex);
        if (startIndex === -1) break;
        
        stack.push(startIndex);
        lastIndex = startIndex + 2;
        
        while (stack.length > 0) {
          const nextStart = content.indexOf('/*', lastIndex);
          const nextEnd = content.indexOf('*/', lastIndex);
          
          if (nextEnd === -1) {
            // Unclosed comment, stop processing
            stack = [];
            break;
          }
          
          if (nextStart !== -1 && nextStart < nextEnd) {
            stack.push(nextStart);
            lastIndex = nextStart + 2;
          } else {
            const start = stack.pop();
            lastIndex = nextEnd + 2;
            
            if (stack.length === 0) {
              const commentText = content.slice(start, nextEnd + 2);
              const newlines = commentText.match(/\n/g) || [];
              content = content.slice(0, start) + newlines.join('') + content.slice(nextEnd + 2);
              lastIndex = start;
            }
          }
        }
      }

      // Restore preserved strings
      content = content.replace(/PRESERVED_STRING_(\d+)/g, (_, index) => {
        return preservedStrings[index];
      });

      // Process content line by line to preserve formatting
      const lines = content.split('\n');
      content = lines
        .map((line, index, arr) => {
          const originalIndent = line.match(/^(\s*)/)[0];
          const trimmedLine = line.trim();
          
          // Keep empty lines between blocks
          if (!trimmedLine) {
            const prevLine = arr[index - 1];
            const nextLine = arr[index + 1];
            // Keep empty lines only between non-empty lines that have content
            if (prevLine?.trim() && nextLine?.trim() &&
                !prevLine.trim().endsWith('{') && 
                !nextLine.trim().startsWith('}')) {
              return originalIndent;
            }
            return null;
          }

          // Preserve string indentation and content
          if (trimmedLine.includes('PRESERVED_STRING_') || 
              trimmedLine.includes('"""') || 
              trimmedLine.includes("'''")) {
            return line;
          }

          // Keep original indentation for non-empty lines
          return originalIndent + trimmedLine;
        })
        .filter((line, index, arr) => {
          if (line === null) return false;
          
          // Keep non-empty lines and meaningful empty lines
          const trimmed = line?.trim();
          if (!trimmed) {
            const prevNonEmpty = arr.slice(0, index).reverse().find(l => l !== null && l?.trim());
            const nextNonEmpty = arr.slice(index + 1).find(l => l !== null && l?.trim());
            return prevNonEmpty && nextNonEmpty &&
                   !prevNonEmpty.trim().endsWith('{') && 
                   !nextNonEmpty.trim().startsWith('}');
          }
          return true;
        })
        .join('\n');

      // Only write if content has changed
      if (content !== originalContent) {
        await fs.writeFile(filePath, content);
        results.push({ file, success: true });
        console.log(`Processed: ${file}`);
      }
    }

    console.log('\nComments removed successfully!');
    return results;
  } catch (error) {
    console.error('Error:', error.message);
    throw error;
  }
}

// Only run this block if this file is being run directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const projectPath = process.argv[2];
  if (!projectPath) {
    console.log('Usage: node index.js <flutter-project-path>');
    console.log('Example: node index.js /path/to/flutter/project');
    process.exit(1);
  }

  removeComments(projectPath).catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}