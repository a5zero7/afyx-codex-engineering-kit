import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import * as grammars from '../src/extraction/grammars';
import { extractNativeVbnetFacts } from '../src/extraction/native/vbnet-facts';
import { scanSource } from '../src/extraction/native/scanner';
import { tokenizeSource } from '../src/extraction/syntax-tokens';
import { extractFromSource } from '../src/extraction/tree-sitter';

const SOURCE = `Imports System.Collections.Generic
Namespace Acme.Billing
Public Interface IRepository
    Function GetById(id As Integer) As Invoice
End Interface
Public Structure Money
    Public Amount As Decimal
End Structure
Public Enum InvoiceState
    Draft
    Paid
End Enum
Public MustInherit Class EntityBase
End Class
Public Class Invoice
    Inherits EntityBase
    Implements IRepository
    Private ReadOnly _lines As New List(Of String)
    Public Const MaxLines As Integer = 100
    Public Event PaidEvent(amount As Decimal)
    Public Property State As InvoiceState
    Public Sub New(id As Integer)
        Me.State = InvoiceState.Draft
    End Sub
    Public Function GetById(id As Integer) As Invoice
        Return New Invoice(id)
    End Function
    Public Sub AddLine(description As String)
        _lines.Add(description)
        VALIDATE(description)
    End Sub
    Private Sub Validate(text As String)
    End Sub
End Class
Public Module Helpers
    Public Delegate Function Mapper(value As Integer) As Integer
    Public Function Twice(value As Integer) As Integer
        Return value * 2
    End Function
End Module
End Namespace
`;

function contract(result: ReturnType<typeof extractFromSource>) {
  return {
    nodes: result.nodes.filter((node) => node.kind !== 'file').map((node) => `${node.kind}:${node.name}`).sort(),
    relations: result.unresolvedReferences
      .filter((reference) => ['extends', 'implements', 'calls', 'instantiates', 'imports'].includes(reference.referenceKind))
      .map((reference) => `${reference.referenceKind}:${reference.referenceName}`).sort(),
  };
}

describe('Afyx-native VB.NET facts', () => {
  beforeAll(async () => {
    await grammars.initGrammars();
    await grammars.loadGrammarsForLanguages(['vbnet']);
  });

  afterEach(() => {
    delete process.env.AFYX_GRAPH_NATIVE_PARSER;
    vi.restoreAllMocks();
  });

  it('preserves the established semantic contract against the parser fallback', () => {
    delete process.env.AFYX_GRAPH_NATIVE_PARSER;
    const oldResult = extractFromSource('Invoice.vb', SOURCE, 'vbnet');
    process.env.AFYX_GRAPH_NATIVE_PARSER = '1';
    const newResult = extractFromSource('Invoice.vb', SOURCE, 'vbnet');
    expect(contract(newResult)).toEqual(contract(oldResult));
    expect(newResult.nodes.find((node) => node.kind === 'method' && node.name === 'GetById')?.returnType).toBe('Invoice');
  });

  it('routes native-gated semantic extraction without requesting a parser', () => {
    const parser = vi.spyOn(grammars, 'getParser');
    process.env.AFYX_GRAPH_NATIVE_PARSER = '1';
    const result = extractFromSource('Invoice.vb', SOURCE, 'vbnet');
    expect(result.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'class', name: 'Invoice' }),
      expect.objectContaining({ kind: 'method', name: 'AddLine' }),
      expect.objectContaining({ kind: 'type_alias', name: 'Mapper' }),
    ]));
    expect(parser).not.toHaveBeenCalled();
  });

  it('handles VB lexical boundaries without leaking XML or comments into facts', () => {
    const source = `REM Function Fake()\n' Class Hidden\nClass Visible\n Function Xml() As Object\n  Dim value = <Tags><Tag /></Tags>\n  Return "a""b"\n End Function\nEnd Class`;
    const scan = scanSource(source, { hashComments: false, vbnetSyntax: true });
    expect(scan.tokens.filter((token) => token.kind === 'comment')).toHaveLength(2);
    expect(scan.tokens.some((token) => token.kind === 'string' && token.text.startsWith('<Tags>'))).toBe(true);
    const result = extractNativeVbnetFacts('Visible.vb', source);
    expect(result.nodes.some((node) => node.name === 'Fake' || node.name === 'Hidden' || node.name === 'Tag')).toBe(false);
    expect(result.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'class', name: 'Visible' }),
      expect.objectContaining({ kind: 'method', name: 'Xml' }),
    ]));
  });

  it('classifies mixed-case VB.NET source natively', async () => {
    const parser = vi.spyOn(grammars, 'getParser');
    process.env.AFYX_GRAPH_NATIVE_PARSER = '1';
    const source = "pUbLiC cLaSs Worker\n  Public Function Run(value As Integer) As String\n  End Function\nEnd Class";
    const result = await tokenizeSource(source, 'vbnet');
    expect(result?.spans.some((span) => span.cls === 'keyword' && source.slice(span.start, span.end) === 'cLaSs')).toBe(true);
    expect(result?.spans.some((span) => span.cls === 'type' && source.slice(span.start, span.end) === 'Integer')).toBe(true);
    expect(result?.spans.some((span) => span.cls === 'def' && source.slice(span.start, span.end) === 'Run')).toBe(true);
    expect(parser).not.toHaveBeenCalled();
  });

  it('keeps multiline lambda calls owned by the enclosing routine', () => {
    const source = `Class Worker
 Function Run(value As Integer) As Integer
  Dim mapper = Function(item As Integer)
   Return Transform(item)
  End Function
  AfterMap()
  Return mapper(value)
 End Function
End Class`;
    const result = extractNativeVbnetFacts('Worker.vb', source);
    const methods = result.nodes.filter((node) => node.kind === 'method').map((node) => node.name);
    const calls = result.unresolvedReferences.filter((reference) => reference.referenceKind === 'calls').map((reference) => reference.referenceName);
    expect(methods).toEqual(['Run']);
    expect(calls).toEqual(expect.arrayContaining(['Transform', 'AfterMap', 'mapper']));
  });

  it('retains bounded prefix facts for incomplete editor input', () => {
    const source = 'Class Tail\n Public Sub Run(value As String)\n  Log(value';
    const result = extractNativeVbnetFacts('Tail.vb', source);
    expect(result.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'class', name: 'Tail' }),
      expect.objectContaining({ kind: 'method', name: 'Run' }),
    ]));
    expect(result.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'native_incomplete_source' }),
    ]));
  });
});
