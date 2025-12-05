// lib/githubAPI.ts - GitHub API integration for repo creation
import { Octokit } from '@octokit/rest';

export interface CreateRepoOptions {
  name: string;
  description?: string;
  private?: boolean;
  token: string;
}

export interface GitHubRepo {
  name: string;
  fullName: string;
  url: string;
  cloneUrl: string;
  sshUrl: string;
}

/**
 * Create a new GitHub repository
 */
export async function createGitHubRepo(options: CreateRepoOptions): Promise<GitHubRepo> {
  const octokit = new Octokit({
    auth: options.token,
    request: {
      timeout: 30000, // 30 seconds timeout (increased from default 10s)
    },
  });

  try {
    const response = await octokit.repos.createForAuthenticatedUser({
      name: options.name,
      description: options.description || 'Created with QuantumIDE',
      private: options.private ?? false,
      auto_init: false, // We'll push from container
    });

    return {
      name: response.data.name,
      fullName: response.data.full_name,
      url: response.data.html_url,
      cloneUrl: response.data.clone_url,
      sshUrl: response.data.ssh_url,
    };
  } catch (error: any) {
    if (error.status === 422) {
      throw new Error('Repository already exists or name is invalid');
    }
    throw new Error(`Failed to create GitHub repository: ${error.message}`);
  }
}

/**
 * Check if user has valid GitHub token
 */
export async function validateGitHubToken(token: string): Promise<boolean> {
  const octokit = new Octokit({
    auth: token,
    request: {
      timeout: 30000, // 30 seconds timeout
    },
  });

  try {
    await octokit.users.getAuthenticated();
    return true;
  } catch {
    return false;
  }
}

/**
 * Get authenticated user info
 */
export async function getGitHubUser(token: string) {
  const octokit = new Octokit({
    auth: token,
    request: {
      timeout: 30000, // 30 seconds timeout
    },
  });

  try {
    const response = await octokit.users.getAuthenticated();
    return {
      username: response.data.login,
      name: response.data.name,
      email: response.data.email,
      avatarUrl: response.data.avatar_url,
    };
  } catch (error: any) {
    throw new Error(`Failed to get GitHub user: ${error.message}`);
  }
}
