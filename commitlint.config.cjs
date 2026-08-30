// commitlint.config.js
// 基于 Conventional Commits 规范
// 安装: npm install --save-dev @commitlint/config-conventional @commitlint/cli

module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // 类型枚举，严格限制提交类型
    'type-enum': [
      2,
      'always',
      [
        'feat',     // 新功能
        'fix',      // 修复 Bug
        'docs',     // 文档变更
        'style',    // 代码格式（不影响逻辑）
        'refactor', // 代码重构
        'perf',     // 性能优化
        'test',     // 测试相关
        'chore',    // 构建/工具/依赖
        'ci',       // CI 配置
        'build',    // 构建系统
        'revert',   // 回滚提交
      ],
    ],
    // type 必须为小写
    'type-case': [2, 'always', 'lower-case'],
    // type 不能为空
    'type-empty': [2, 'never'],
    // scope 可选，但必须小写
    'scope-case': [2, 'always', 'lower-case'],
    // subject 不能为空
    'subject-empty': [2, 'never'],
    // subject 必须以动词开头，禁止以句号结尾
    'subject-full-stop': [2, 'never', '.'],
    // subject 首字母小写
    'subject-case': [2, 'never', ['sentence-case', 'start-case', 'pascal-case', 'upper-case']],
    // header 最大长度 72 字符
    'header-max-length': [2, 'always', 72],
    // body 每行最大长度 100 字符
    'body-max-line-length': [2, 'always', 100],
    // footer 每行最大长度 100 字符
    'footer-max-line-length': [2, 'always', 100],
  },
  // 自定义提示信息
  prompt: {
    messages: {
      skip: '回车跳过',
      max: '最多 %d 个字符',
      min: '至少 %d 个字符',
      emptyWarning: '不能为空',
      upperLimitWarning: '超过长度限制',
      lowerLimitWarning: '低于最小长度',
    },
    questions: {
      type: {
        description: '选择你要提交的变更类型',
        enum: {
          feat: {
            description: '新功能',
            title: 'Features',
            emoji: '✨',
          },
          fix: {
            description: '修复 Bug',
            title: 'Bug Fixes',
            emoji: '🐛',
          },
          docs: {
            description: '仅文档变更',
            title: 'Documentation',
            emoji: '📚',
          },
          style: {
            description: '代码格式调整（空格、分号、缩进等，不影响逻辑）',
            title: 'Styles',
            emoji: '💎',
          },
          refactor: {
            description: '代码重构（既不修复 bug，也不添加功能）',
            title: 'Code Refactoring',
            emoji: '📦',
          },
          perf: {
            description: '性能优化',
            title: 'Performance Improvements',
            emoji: '🚀',
          },
          test: {
            description: '添加或修改测试',
            title: 'Tests',
            emoji: '🚨',
          },
          chore: {
            description: '构建过程、辅助工具、依赖更新等杂项',
            title: 'Chores',
            emoji: '⚙️',
          },
          ci: {
            description: 'CI 配置变更',
            title: 'Continuous Integrations',
            emoji: '⚡️',
          },
          build: {
            description: '构建系统或外部依赖变更',
            title: 'Builds',
            emoji: '🛠',
          },
          revert: {
            description: '回滚之前的提交',
            title: 'Reverts',
            emoji: '🗑',
          },
        },
      },
      scope: {
        description: '变更的范围（模块/组件/目录，可选）',
      },
      subject: {
        description: '简短描述本次提交的内容（动词开头，如：添加、修复、更新）',
      },
      body: {
        description: '详细描述（可选）：为什么修改、如何修改、影响范围',
      },
      isBreaking: {
        description: '是否包含破坏性变更（Breaking Change）？',
      },
      breakingBody: {
        description: '破坏性变更的详细描述',
      },
      breaking: {
        description: '破坏性变更的简短说明',
      },
      isIssueAffected: {
        description: '是否关联 Issue/Ticket？',
      },
      issuesBody: {
        description: '关闭 Issue 的原因',
      },
      issues: {
        description: '关联的 Issue 编号（如 #123, JIRA-456）',
      },
    },
  },
};
