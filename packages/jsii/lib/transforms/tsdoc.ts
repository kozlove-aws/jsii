import * as ts from 'typescript';

export function rewriteTsdoc(ctx: ts.TransformationContext) {
  return (source: ts.SourceFile): ts.SourceFile => {
    const result = ts.visitEachChild(source, visitor, ctx);
    console.log(
      `source ${source.getFullText()} ${source.getFullStart()} ${source.getFullWidth()}`,
    );
    return result;

    function visitor(node: ts.Node): ts.Node {
      const handled = handleNode(node, source);
      return ts.visitEachChild(handled, visitor, ctx);
    }
  };
}

function handleNode<T extends ts.Node>(node: T, source: ts.SourceFile): T {
  if (ts.isClassDeclaration(node)) {
    const comment = tsdocExperimental(node, source);
    if (comment !== undefined) {
      return updateExperimentalDocString(node, source, comment);
    }
  }
  return node;
}

function tsdocExperimental(
  node: ts.Node,
  source: ts.SourceFile,
): CommentRange | undefined {
  const nodeText = node.getFullText(source);
  const commentranges = ts.getLeadingCommentRanges(nodeText, 0);
  if (!commentranges) {
    return undefined;
  }
  const filtered = commentranges
    .map((cr) => {
      return {
        ...cr,
        commentText: nodeText.slice(cr.pos, cr.end),
      };
    })
    .filter((cr) => {
      const commentText = nodeText.slice(cr.pos, cr.end);
      const experimentalRegex = new RegExp('@experimental\\s');
      if (
        cr.kind === ts.SyntaxKind.MultiLineCommentTrivia &&
        commentText.startsWith('/**') &&
        experimentalRegex.exec(commentText) !== null
      ) {
        return true;
      }
      return false;
    });
  if (filtered.length === 0) {
    return undefined;
  } else if (filtered.length > 1) {
    throw new Error('more than one tsdoc'); // FIXME
  }
  return filtered[0];
}

function updateExperimentalDocString<T extends ts.Node>(
  node: T,
  source: ts.SourceFile,
  comment: CommentRange,
): T {
  const newComment = `/** EXPERIMENTAL API ${comment.commentText.slice(
    3,
    comment.commentText.length - 3,
  )}*/`;

  const nodeText = node.getFullText(source);
  const commentranges = ts.getLeadingCommentRanges(nodeText, 0);

  if (commentranges) {
    const range = commentranges[0]; // FIXME - for now just the first
    const srcText = source.getFullText();
    // console.log(`before replace [${source.text}]`);
    source.text =
      srcText.slice(0, node.getFullStart() + range.pos) +
      newComment +
      srcText.slice(node.getFullStart() + range.end);
    source.end += 17;
    // console.log(`replaced [${source.text}]`);
  }

  return node;
}

interface CommentRange extends ts.CommentRange {
  readonly commentText: string;
}
