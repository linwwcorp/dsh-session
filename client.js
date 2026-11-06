/**
 * Browser half of the dsh-session bundle: a conversation-scoped take on tool
 * approvals.
 *
 * The card replaces the shipped approval composer so it can offer a third
 * action, "允许当前对话": it grants the pending request and answers every later
 * request of the same Session for the rest of the running turn, so one answer
 * covers all permissions the current question needs. The grant lives in
 * browser memory, is never logged, and is dropped as soon as the turn stops.
 */
window.__ModuleLoader__.load({
  id: 'dsh-session',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    const NS = 'dsh-session'
    /** Session ids whose later approvals answer themselves until the turn ends. */
    const granted = new Set()

    const COLOR = {
      text: 'var(--dsw-alias-label-primary)',
      muted: 'var(--dsw-alias-label-secondary)',
      border: 'var(--dsw-alias-border-l1)',
      surface: 'var(--dsw-alias-bg-layer-1)',
      warn: 'var(--dsw-alias-state-warn-primary)',
      brand: 'var(--dsw-alias-brand-primary)',
    }

    const buttonBase = {
      appearance: 'none',
      borderRadius: '8px',
      padding: '6px 14px',
      font: 'inherit',
      fontSize: '13px',
      lineHeight: '20px',
      cursor: 'pointer',
      border: `1px solid ${COLOR.border}`,
      background: 'transparent',
      color: COLOR.text,
      transition: 'opacity 120ms ease, background-color 120ms ease',
    }

    function buttonStyle(kind) {
      if (kind === 'primary') {
        return { ...buttonBase, borderColor: COLOR.brand, background: COLOR.brand, color: '#fff' }
      }
      return buttonBase
    }

    /** One approval prompt with reject, allow once, and allow this conversation. */
    function SessionApprovalCard(props) {
      const approval = props.matched
      const t = props.t
      const sessionKey = String(
        approval.sessionId !== undefined && approval.sessionId !== null
          ? approval.sessionId
          : props.sessionId ?? '',
      )
      const [answered, setAnswered] = React.useState(false)
      const settled = React.useRef(false)
      const mounted = React.useRef(true)

      React.useEffect(() => {
        mounted.current = true
        return () => { mounted.current = false }
      }, [])

      const answer = React.useCallback((outcome) => {
        if (settled.current) return
        settled.current = true
        setAnswered(true)
        Promise.resolve()
          .then(() => approval.answer(outcome))
          .catch(() => {
            if (!mounted.current) return
            settled.current = false
            setAnswered(false)
          })
      }, [approval])

      // A session granted earlier answers its remaining prompts before the
      // browser paints them, so the user sees no second prompt at all.
      React.useLayoutEffect(() => {
        if (sessionKey !== '' && granted.has(sessionKey)) answer('allowed-once')
      }, [answer, sessionKey])

      const grantConversation = React.useCallback(() => {
        if (sessionKey !== '') granted.add(sessionKey)
        answer('allowed-once')
      }, [answer, sessionKey])

      const onKeyDown = React.useCallback((event) => {
        if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return
        const target = event.target
        if (target !== null && typeof target.closest === 'function'
          && target.closest('input, textarea, select, [contenteditable="true"], [contenteditable=""]') !== null) return
        if (event.key === 'Enter') {
          if (target !== null && typeof target.closest === 'function' && target.closest('button') !== null) return
          event.preventDefault()
          answer('allowed-once')
        } else if (event.key === 'Escape') {
          event.preventDefault()
          answer('rejected')
        }
      }, [answer])

      const reason = props.resolveReason === undefined ? undefined : (() => {
        if (approval.displayReason !== undefined) return props.resolveReason(approval.displayReason)
        return approval.reason
      })()
      const title = reason !== undefined && reason !== ''
        ? reason
        : t('escalation', { toolName: String(approval.toolName) })

      return h('div', {
        'data-dsh-session-approval': 'card',
        onKeyDown,
        style: {
          border: `1px solid ${COLOR.border}`,
          borderRadius: '12px',
          background: COLOR.surface,
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.06)',
        },
      }, [
        h('div', {
          key: 'status',
          style: {
            display: 'flex', alignItems: 'center', gap: '6px',
            fontSize: '12px', lineHeight: '16px', color: COLOR.muted,
          },
        }, [
          h('span', {
            key: 'dot',
            'aria-hidden': true,
            style: {
              width: '6px', height: '6px', borderRadius: '50%',
              background: answered ? COLOR.brand : COLOR.warn,
            },
          }),
          h('span', { key: 'label' }, answered ? t('answered') : t('waiting')),
        ]),
        h('div', {
          key: 'title',
          style: { fontSize: '14px', lineHeight: '21px', color: COLOR.text, wordBreak: 'break-word' },
        }, title),
        h('div', {
          key: 'actions',
          style: { display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'flex-end' },
        }, [
          h('button', {
            key: 'reject',
            type: 'button',
            disabled: answered,
            style: { ...buttonStyle('outline'), color: COLOR.muted },
            onClick: () => { answer('rejected') },
          }, t('reject')),
          h('button', {
            key: 'once',
            type: 'button',
            disabled: answered,
            style: buttonStyle('outline'),
            onClick: () => { answer('allowed-once') },
          }, t('allowOnce')),
          h('button', {
            key: 'session',
            type: 'button',
            disabled: answered,
            title: t('allowSessionHint'),
            style: buttonStyle('primary'),
            onClick: grantConversation,
          }, t('allowSession')),
        ]),
      ])
    }

    const zh = {
      waiting: '等待审批',
      answered: '已处理',
      escalation: '工具 {toolName} 请求越权执行',
      reject: '拒绝',
      allowOnce: '允许一次',
      allowSession: '允许当前对话',
      allowSessionHint: '本轮后续的审批不再询问；本轮结束后会重新询问',
    }
    const en = {
      waiting: 'Waiting for approval',
      answered: 'Handled',
      escalation: 'Tool {toolName} requests privileged execution',
      reject: 'Reject',
      allowOnce: 'Allow once',
      allowSession: 'Allow this conversation',
      allowSessionHint: 'Answers the rest of this turn without asking; the next turn asks again',
    }

    return {
      inject: ['slots', 'locale', 'remote'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-session: dictionaries')
        // The grant lives exactly as long as the Session's running turn: the
        // Host's running transition to false — finished, stopped, or failed —
        // revokes it, so the next message asks again.
        ctx.effect(() => ctx.remote.$on('api-session/status', (sessionId, running) => {
          if (!running) granted.delete(String(sessionId))
        }), 'dsh-session: grant lifetime')
        ctx.slots.inject('conversation.composer', () => ctx.slots.register({
          name: 'conversation.composer',
          // Ahead of the shipped approval entry (priority 1) so this card owns
          // approval prompts; every other interaction falls through.
          priority: 0.5,
          locale: NS,
          select: ({ pendingInteraction }) => (
            pendingInteraction !== undefined
            && pendingInteraction !== null
            && pendingInteraction.kind === 'approval'
            && typeof pendingInteraction.answer === 'function'
          ) ? pendingInteraction : null,
          inject: () => ({
            resolveReason: (text) => ctx.locale.resolveText(text),
          }),
        }, SessionApprovalCard))
      },
    }
  },
})
