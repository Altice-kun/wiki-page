interface GitHubPushOptions {
  owner: string;
  repo: string;
  branch: string;
  filePath: string; // 例: "docs/index.md"
  content: string;  // Markdown本文
  commitMessage: string;
  token: string;    // GitHub Personal Access Token または GitHub App Token
}

export async function pushMarkdownToGitHub(options: GitHubPushOptions): Promise<boolean> {
  const { owner, repo, branch, filePath, content, commitMessage, token } = options;
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;

  // 1. 既存ファイルのSHAを取得（更新時に必要）
  let sha: string | undefined = undefined;
  try {
    const getRes = await fetch(`${url}?ref=${branch}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'Hinomoto-Wiki-Worker',
        'Accept': 'application/vnd.github+json',
      },
    });
    if (getRes.ok) {
      const data: any = await getRes.json();
      sha = data.sha;
    }
  } catch (e) {
    // ファイルが存在しない場合は新規作成となるため無視
  }

  // 2. ファイルを作成・更新（PUTリクエスト）
  const encodedContent = btoa(unescape(encodeURIComponent(content))); // UTF-8対応のBase64エンコード
  const putRes = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'User-Agent': 'Hinomoto-Wiki-Worker',
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: commitMessage,
      content: encodedContent,
      branch: branch,
      ...(sha ? { sha } : {}),
    }),
  });

  return putRes.ok;
}
