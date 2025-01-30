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

  test('should handle empty files', async () => {
    const content = '';
    const expected = '';
    await createTestFile(content);
    await removeComments(tmpDir.path);
    const result = await fs.readFile(path.join(tmpDir.path, 'lib', 'main.dart'), 'utf8');
    expect(result).toBe(expected);
  });

  test('should handle files with only comments', async () => {
    const content = `// Single line comment
/* Multi-line
   comment */
/// Documentation comment`;
    const expected = '';
    await createTestFile(content);
    await removeComments(tmpDir.path);
    const result = await fs.readFile(path.join(tmpDir.path, 'lib', 'main.dart'), 'utf8');
    expect(result).toBe(expected);
  });

  test('should handle unclosed multi-line comments', async () => {
    const content = `void main() {
  /* Unclosed comment
  print('This should be removed');
}`;
    const expected = `void main() {
  print('This should be removed');
}`;
    await createTestFile(content);
    await removeComments(tmpDir.path);
    const result = await fs.readFile(path.join(tmpDir.path, 'lib', 'main.dart'), 'utf8');
    expect(result).toBe(expected);
  });

  test('should handle escaped quotes in strings', async () => {
    const content = `void main() {
  print('String with \\'quoted\\' content // not a comment');
  print("String with \\"quoted\\" content /* not a comment */");
}`;
    const expected = `void main() {
  print('String with \\'quoted\\' content // not a comment');
  print("String with \\"quoted\\" content /* not a comment */");
}`;
    await createTestFile(content);
    await removeComments(tmpDir.path);
    const result = await fs.readFile(path.join(tmpDir.path, 'lib', 'main.dart'), 'utf8');
    expect(result).toBe(expected);
  });

  test('should handle comments inside interpolated strings', async () => {
    const content = `void main() {
  print('Value: \${
    // This comment should be removed
    getValue() /* remove this too */
  }');
  print("\${
    list // remove this
      .map((e) => e) /* and this */
      .toList()
  }");
  print('''
    \${
      data  // remove comment
        .process() /* remove this comment */
        .format()
    }
  ''');
}`;
    const expected = `void main() {
  print('Value: \${
    getValue()
  }');
  print("\${
    list
      .map((e) => e)
      .toList()
  }");
  print('''
    \${
      data
        .process()
        .format()
    }
  ''');
}`;
    await createTestFile(content);
    await removeComments(tmpDir.path);
    const result = await fs.readFile(path.join(tmpDir.path, 'lib', 'main.dart'), 'utf8');
    expect(result).toBe(expected);
  });

  test('should handle multiple consecutive comments', async () => {
    const content = `void main() {
  // First comment
  // Second comment
  // Third comment
  print('Hello');
  /* Comment 1 *//* Comment 2 *//* Comment 3 */
  print('World');
}`;
    const expected = `void main() {
  print('Hello');
  print('World');
}`;
    await createTestFile(content);
    const results = await removeComments(tmpDir.path);
    expect(results.length).toBe(1);
    expect(results[0].success).toBe(true);
    const result = await fs.readFile(path.join(tmpDir.path, 'lib', 'main.dart'), 'utf8');
    expect(result).toBe(expected);
  });

  test('should handle comments with special characters', async () => {
    const content = `void main() {
  // Comment with @#$%^&*()_+
  /* Comment with 
     🎉🌟✨💫 emojis */
  /// Documentation with <html> tags
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

  test('should handle mixed comment types on same line', async () => {
    const content = `void main() {
  /* Multi-line */ // Single-line /// Doc comment
  print('Hello'); /* Comment */ // Another /* Nested */
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

  test('should handle multiple files in different subdirectories', async () => {
    await fs.mkdir(path.join(tmpDir.path, 'lib/src'));
    await fs.mkdir(path.join(tmpDir.path, 'lib/widgets'));
    
    const files = {
      'main.dart': 'void main() { /* Main */ }',
      'src/utils.dart': '// Utility functions\nString helper() => "test";',
      'widgets/custom.dart': 'class Custom { /// Widget comment\n }'
    };

    for (const [file, content] of Object.entries(files)) {
      await createTestFile(content, file);
    }

    const results = await removeComments(tmpDir.path);
    expect(results.length).toBe(3);
    expect(results.every(r => r.success)).toBe(true);
  });

  test('should handle files with mixed line endings', async () => {
    const content = '// Comment 1\r\n/* Comment 2 */\n/// Comment 3\r/* Comment 4 */\nprint("Hello");';
    const expected = 'print("Hello");';
    
    await createTestFile(content);
    await removeComments(tmpDir.path);
    const result = await fs.readFile(path.join(tmpDir.path, 'lib', 'main.dart'), 'utf8');
    expect(result).toBe(expected);
  });

  test('should handle comments with Unicode characters', async () => {
    const content = `void main() {
  // コメント
  /* मुख्य टिप्पणी */
  /// تعليق
  print('Hello');
}`;
    const expected = `void main() {
  print('Hello');
}`;
    
    await createTestFile(content);
    await removeComments(tmpDir.path);
    const result = await fs.readFile(path.join(tmpDir.path, 'lib', 'main.dart'), 'utf8');
    expect(result).toBe(expected);
  });

  test('should handle large files with many comments', async () => {
    let content = '';
    for (let i = 0; i < 1000; i++) {
      content += `// Comment ${i}\n/* Block ${i} */\n/// Doc ${i}\nprint(${i});\n`;
    }
    
    await createTestFile(content);
    const results = await removeComments(tmpDir.path);
    expect(results.length).toBe(1);
    expect(results[0].success).toBe(true);
    
    const result = await fs.readFile(path.join(tmpDir.path, 'lib', 'main.dart'), 'utf8');
    expect(result.split('\n').filter(line => line.includes('print(')).length).toBe(1000);
  });

  test('should handle files with read-only permissions', async () => {
    const content = '// Comment\nprint("Hello");';
    const filePath = await createTestFile(content);
    await fs.chmod(filePath, 0o444);
    
    await expect(removeComments(tmpDir.path)).rejects.toThrow();
  });

  test('should handle deeply nested comments', async () => {
    const content = `void main() {
  /* Level 1
    /* Level 2
      /* Level 3
        /* Level 4 */
      Still level 3 */
    Still level 2 */
  Still level 1 */
  print('Hello');
}`;
    const expected = `void main() {
  print('Hello');
}`;
    
    await createTestFile(content);
    await removeComments(tmpDir.path);
    const result = await fs.readFile(path.join(tmpDir.path, 'lib', 'main.dart'), 'utf8');
    expect(result).toBe(expected);
  });

  test('should handle comments in string concatenation', async () => {
    const content = `void main() {
      final str = 'prefix' + /* comment */ 'suffix';
      final multi = 'start' + // comment
                   'middle' + /// doc
                   'end';
    }`;
    const expected = `void main() {
      final str = 'prefix' + 'suffix';
      final multi = 'start' +
                   'middle' +
                   'end';
    }`;
    await createTestFile(content);
    await removeComments(tmpDir.path);
    const result = await fs.readFile(path.join(tmpDir.path, 'lib', 'main.dart'), 'utf8');
    expect(result).toBe(expected);
  });

  test('should handle comments in method chaining', async () => {
    const content = `void main() {
      list
        .map((e) => e) // transform
        /* filter */
        .where((e) => true)
        /// sort
        .toList();
    }`;
    const expected = `void main() {
      list
        .map((e) => e)
        .where((e) => true)
        .toList();
    }`;
    await createTestFile(content);
    await removeComments(tmpDir.path);
    const result = await fs.readFile(path.join(tmpDir.path, 'lib', 'main.dart'), 'utf8');
    expect(result).toBe(expected);
  });

  test('should handle comments in complex string interpolation', async () => {
    const content = `void main() {
      print('Value: \${
        // Comment inside interpolation
        getValue() /* another comment */
      }');
      print('\${/* start */list.map((e) => e/* transform */).toList()/* end */}');
    }`;
    const expected = `void main() {
      print('Value: \${
        getValue()
      }');
      print('\${list.map((e) => e).toList()}');
    }`;
    await createTestFile(content);
    await removeComments(tmpDir.path);
    const result = await fs.readFile(path.join(tmpDir.path, 'lib', 'main.dart'), 'utf8');
    expect(result).toBe(expected);
  });

  test('should handle comments in trailing commas', async () => {
    const content = `final map = {
      'key1': 'value1', // first
      'key2': 'value2', /* second */
      'key3': 'value3', /// third
    };`;
    const expected = `final map = {
      'key1': 'value1',
      'key2': 'value2',
      'key3': 'value3',
    };`;
    await createTestFile(content);
    await removeComments(tmpDir.path);
    const result = await fs.readFile(path.join(tmpDir.path, 'lib', 'main.dart'), 'utf8');
    expect(result).toBe(expected);
  });

  test('should handle nested string interpolation with comments', async () => {
    const content = `void main() {
      print('\${
        'nested \${
          // inner comment
          getValue() /* inner block */
        } outer \${
          // outer comment
          process() /* outer block */
        }'
      }');
    }`;
    const expected = `void main() {
      print('\${
        'nested \${
          getValue()
        } outer \${
          process()
        }'
      }');
    }`;
    await createTestFile(content);
    await removeComments(tmpDir.path);
    const result = await fs.readFile(path.join(tmpDir.path, 'lib', 'main.dart'), 'utf8');
    expect(result).toBe(expected);
  });

  test('should handle string interpolation with line breaks in comments', async () => {
    const content = `void main() {
      print('\${
        /* multi-line
           comment in
           interpolation */
        getValue()
        // line break
        .toString()
      }');
    }`;
    const expected = `void main() {
      print('\${
        getValue()
        .toString()
      }');
    }`;
    await createTestFile(content);
    await removeComments(tmpDir.path);
    const result = await fs.readFile(path.join(tmpDir.path, 'lib', 'main.dart'), 'utf8');
    expect(result).toBe(expected);
  });

  test('should handle mixed string types with interpolation and comments', async () => {
    const content = `void main() {
      print(r'''\${
        // raw string comment
        getData() /* in raw */
      }''');
      print("""\${
        // triple quote comment
        process() /* in triple */
      }""");
    }`;
    const expected = `void main() {
      print(r'''\${
        getData()
      }''');
      print("""\${
        process()
      }""");
    }`;
    await createTestFile(content);
    await removeComments(tmpDir.path);
    const result = await fs.readFile(path.join(tmpDir.path, 'lib', 'main.dart'), 'utf8');
    expect(result).toBe(expected);
  });

  test('should handle complex string literals with interpolation and comments', async () => {
    const content = `void main() {
      // Test raw multi-line string with escaped interpolation
      print(r'''\${
        // raw string comment
        getData() /* in raw */
      }''');
      

      // Test triple-quoted string with escaped interpolation
      print("""\${
        // triple quote comment
        process() /* in triple */
      }""");
      

      // Test mixed quotes with nested interpolation
      print(r"""Value: \${
        getData(r'\${/* nested comment */}') // comment in param
      }""");
      

      // Test escaped interpolation in raw string
      print(r'Value: \${/* should preserve this comment */}');
    }`;
    const expected = `void main() {
      print(r'''\${
        getData()
      }''');
      print("""\${
        process()
      }""");
      print(r"""Value: \${
        getData(r'\${}')
      }""");
      print(r'Value: \${}');
    }`;
    
    await createTestFile(content);
    await removeComments(tmpDir.path);
    const result = await fs.readFile(path.join(tmpDir.path, 'lib', 'main.dart'), 'utf8');
    expect(result).toBe(expected);
  });
  test('should handle malformed interpolation syntax', async () => {
    const content = `void main() {
      print('\${'); // Unclosed interpolation
      print('\${}}'); // Extra closing brace
      print('\${/**/}'); // Empty interpolation with comment
      print('Value: \${
        // Nested malformed
        getValue('\${')
      }');
    }`;
    const expected = `void main() {
      print('\${');
      print('\${}}');
      print('\${}');
      print('Value: \${
        getValue('\${')
      }');
    }`;
    await createTestFile(content);
    await removeComments(tmpDir.path);
    const result = await fs.readFile(path.join(tmpDir.path, 'lib', 'main.dart'), 'utf8');
    expect(result).toBe(expected);
  });

  test('should handle comments in string literals with escaped characters', async () => {
    const content = `void main() {
      print('\\n // Not a comment');
      print('\\t /* Not a comment */');
      print('\\\\ // Not a comment');
      print('\\r\\n // Not a comment');
    }`;
    const expected = `void main() {
      print('\\n // Not a comment');
      print('\\t /* Not a comment */');
      print('\\\\ // Not a comment');
      print('\\r\\n // Not a comment');
    }`;
    await createTestFile(content);
    await removeComments(tmpDir.path);
    const result = await fs.readFile(path.join(tmpDir.path, 'lib', 'main.dart'), 'utf8');
    expect(result).toBe(expected);
  });

  test('should handle nested raw strings with interpolation and comments', async () => {
    const content = `void main() {
      print(r'''
        \${r'''
          \${r'''
            // Deeply nested comment
            getValue() /* nested */
          '''}
          // Middle level comment
          process() /* middle */
        '''}
        // Outer level comment
        format() /* outer */
      ''');
    }`;
    const expected = `void main() {
      print(r'''
        \${r'''
          \${r'''
            getValue()
          '''}
          process()
        '''}
        format()
      ''');
    }`;
    await createTestFile(content);
    await removeComments(tmpDir.path);
    const result = await fs.readFile(path.join(tmpDir.path, 'lib', 'main.dart'), 'utf8');
    expect(result).toBe(expected);
  });

  test('should handle mixed string types with escaped characters and comments', async () => {
    const content = `void main() {
      print('\\r\\n\${
        // Comment with escape
        getValue('\\t') /* with tab */
      }\\n');
      print(r'\\n\${
        // Raw string escape
        process('\\r') /* with return */
      }\\r');
    }`;
    const expected = `void main() {
      print('\\r\\n\${
        getValue('\\t')
      }\\n');
      print(r'\\n\${
        process('\\r')
      }\\r');
    }`;
    await createTestFile(content);
    await removeComments(tmpDir.path);
    const result = await fs.readFile(path.join(tmpDir.path, 'lib', 'main.dart'), 'utf8');
    expect(result).toBe(expected);
  });

  test('should handle comments in adjacent string interpolations', async () => {
    const content = `void main() {
      print('\${/* c1 */value1}\${/* c2 */value2}\${/* c3 */value3}');
      print(r'\${// c1
      v1}\${// c2
      v2}\${// c3
      v3}');
    }`;
    const expected = `void main() {
      print('\${value1}\${value2}\${value3}');
      print(r'\${
      v1}\${
      v2}\${
      v3}');
    }`;
    await createTestFile(content);
    await removeComments(tmpDir.path);
    const result = await fs.readFile(path.join(tmpDir.path, 'lib', 'main.dart'), 'utf8');
    expect(result).toBe(expected);
  });
});