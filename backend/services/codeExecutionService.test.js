const { getExtension, getFileName } = require('./codeExecutionService');

describe('getExtension', () => {
  it('maps known languages to their file extension', () => {
    expect(getExtension('python')).toBe('py');
    expect(getExtension('java')).toBe('java');
    expect(getExtension('cpp')).toBe('cpp');
  });

  it('falls back to txt for unknown languages', () => {
    expect(getExtension('cobol')).toBe('txt');
  });
});

describe('getFileName', () => {
  it('uses Main.java for Java, since javac requires the file name to match the public class', () => {
    expect(getFileName('java')).toBe('Main.java');
  });

  it('uses main.<ext> for every other language', () => {
    expect(getFileName('python')).toBe('main.py');
    expect(getFileName('cpp')).toBe('main.cpp');
  });
});
