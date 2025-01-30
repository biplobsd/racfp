import { jest } from '@jest/globals';
import { removeComments } from './index.js';
import fs from 'fs-extra';
import path from 'path';
import { dir } from 'tmp-promise';

describe('Flutter Comment Remover', () => {
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await dir({ unsafeCleanup: true });
    // Create a lib directory to mimic Flutter project structure
    await fs.mkdir(path.join(tmpDir.path, 'lib'));
  });

  afterEach(async () => {
    if (tmpDir) {
      await tmpDir.cleanup();
    }
  });

  async function createTestFile(content, filename = 'main.dart') {
    const filePath = path.join(tmpDir.path, 'lib', filename);
    await fs.writeFile(filePath, content);
    return filePath;
  }

  test('should handle empty directory', async () => {
    const emptyDir = await dir({ unsafeCleanup: true });
    await fs.mkdir(path.join(emptyDir.path, 'lib'));
    const results = await removeComments(emptyDir.path);
    expect(results).toEqual([]);
    await emptyDir.cleanup();
  });

  test('should throw error for invalid directory', async () => {
    await expect(async () => {
      await removeComments('/nonexistent/path');
    }).rejects.toThrow();
  });

  test('should throw error for null path', async () => {
    await expect(async () => {
      await removeComments(null);
    }).rejects.toThrow('Flutter project path is required');
  });

  test('should remove single-line comments', async () => {
    const content = `void main() {
  // This is a comment
  print('Hello'); // End of line comment
}`;
    const expected = `void main() {
  print('Hello');
}`;
    
    await createTestFile(content);
    const results = await removeComments(tmpDir.path);
    expect(results.length).toBe(1);
    expect(results[0].success).toBe(true);
    const result = await fs.readFile(path.join(tmpDir.path, 'lib', 'main.dart'), 'utf8');
    expect(result).toBe(expected);
  });

  test('should remove multi-line comments', async () => {
    const content = `void main() {
  /* This is a
     multi-line comment */
  print('Hello');
}`;
    const expected = `void main() {
  print('Hello');
}`;
    
    await createTestFile(content);
    const results = await removeComments(tmpDir.path);
    expect(results.length).toBe(1);
    expect(results[0].success).toBe(true);
    const result = await fs.readFile(path.join(tmpDir.path, 'lib', 'main.dart'), 'utf8');
    expect(result).toBe(expected);
  });

  test('should remove documentation comments', async () => {
    const content = `void main() {
  /// This is a documentation comment
  print('Hello');
}`;
    const expected = `void main() {
  print('Hello');
}`;
    
    await createTestFile(content);
    const results = await removeComments(tmpDir.path);
    expect(results.length).toBe(1);
    expect(results[0].success).toBe(true);
    const result = await fs.readFile(path.join(tmpDir.path, 'lib', 'main.dart'), 'utf8');
    expect(result).toBe(expected);
  });

  test('should preserve strings containing comment-like content', async () => {
    const content = `void main() {
  print('http://example.com');
  print('Contains // in string');
  print('Contains /* in string */');
  print("""Multi-line string with //
and /* comment-like */ content""");
}`;
    const expected = `void main() {
  print('http://example.com');
  print('Contains // in string');
  print('Contains /* in string */');
  print("""Multi-line string with //
and /* comment-like */ content""");
}`;
    
    await createTestFile(content);
    await removeComments(tmpDir.path);
    const result = await fs.readFile(path.join(tmpDir.path, 'lib', 'main.dart'), 'utf8');
    expect(result).toBe(expected);
  });

  test('should handle nested comments', async () => {
    const content = `void main() {
  /* Outer comment
     /* Nested comment */
     Still in outer comment */
  print('Hello');
}`;
    const expected = `void main() {
  print('Hello');
}`;
    
    await createTestFile(content);
    const results = await removeComments(tmpDir.path);
    expect(results.length).toBe(1);
    expect(results[0].success).toBe(true);
    const result = await fs.readFile(path.join(tmpDir.path, 'lib', 'main.dart'), 'utf8');
    expect(result).toBe(expected);
  });

  test('should preserve URLs in strings', async () => {
    const content = `
      void main() {
        final url = 'https://example.com';
        final path = 'file://localhost/path';
      }
    `;
    const expected = `
      void main() {
        final url = 'https://example.com';
        final path = 'file://localhost/path';
      }
    `;
    
    await createTestFile(content);
    const results = await removeComments(tmpDir.path);
    expect(results.length).toBe(1);
    expect(results[0].success).toBe(true);
    const result = await fs.readFile(path.join(tmpDir.path, 'lib', 'main.dart'), 'utf8');
    expect(result.trim()).toBe(expected.trim());
  });

  test('should handle raw strings', async () => {
    const content = `void main() {
  final raw = r'Contains // and /* */ without being a comment';
  final multiline = r"""
          Raw string with //
          and /* */ content
        """;
}`;
    const expected = `void main() {
  final raw = r'Contains // and /* */ without being a comment';
  final multiline = r"""
          Raw string with //
          and /* */ content
        """;
}`;
    
    await createTestFile(content);
    await removeComments(tmpDir.path);
    const result = await fs.readFile(path.join(tmpDir.path, 'lib', 'main.dart'), 'utf8');
    expect(result).toBe(expected);
  });

  test('should preserve code formatting after comment removal', async () => {
    const content = `class UserWidget extends StatelessWidget {
  // User data
  final String name;
  final int age;    // User age

  Widget build(BuildContext context) {
    return Column(
      children: [
        /* Header section */
        Container(
          padding: EdgeInsets.all(16),
          child: Text(
            name,
            style: TextStyle(
              fontSize: 20,  // Title size
              fontWeight: FontWeight.bold,
            ),
          ),
        ),

        /// Profile section
        Container(
          margin: EdgeInsets.symmetric(
            vertical: 8,
            horizontal: 16,
          ),
          child: Text(
            'Age: \$age',
          ),
        ),
      ],
    );
  }
}`;
    const expected = `class UserWidget extends StatelessWidget {
  final String name;
  final int age;

  Widget build(BuildContext context) {
    return Column(
      children: [
        
        Container(
          padding: EdgeInsets.all(16),
          child: Text(
            name,
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.bold,
            ),
          ),
        ),
        Container(
          margin: EdgeInsets.symmetric(
            vertical: 8,
            horizontal: 16,
          ),
          child: Text(
            'Age: \$age',
          ),
        ),
      ],
    );
  }
}`;
    
    await createTestFile(content);
    const results = await removeComments(tmpDir.path);
    expect(results.length).toBe(1);
    expect(results[0].success).toBe(true);
    const result = await fs.readFile(path.join(tmpDir.path, 'lib', 'main.dart'), 'utf8');
    expect(result).toBe(expected);
  });
});