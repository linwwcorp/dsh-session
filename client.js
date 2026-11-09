/**
 * Browser half of the dsh-session bundle: a conversation-scoped take on tool
 * approvals.
 *
 * The card replaces the shipped approval composer so it can offer a third
 * action, "允许当前对话": it grants the pending request and answers every later
 * request of the same Session for the rest of the running turn, so one answer
 * covers all permissions the current question needs. The grant lives in
 * browser memory, is never logged, and is dropped as soon as the turn stops.
 *
 * Markup and styles mirror the shipped `conversation.approval.card` so the
 * takeover is visually indistinguishable from the built-in prompt.
 */
window.__ModuleLoader__.load({
  id: 'dsh-session',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    const NS = 'dsh-session'
    /** Session ids whose later approvals answer themselves until the turn ends. */
    const granted = new Set()

    const STYLE_ID = 'dsh-session-approval-style'
    const CSS = `
.dsh-s-approval-root {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px calc(var(--dsh-composer-side-clearance, 0px) + 16px) 12px;
}
.dsh-s-approval-card {
  overflow: hidden;
  width: 100%;
  max-width: var(--dsh-chat-content-width, 760px);
  border: 1px solid var(--dsw-alias-state-warn-secondary, var(--dsw-alias-border-l1));
  border-radius: var(--dsw-radius-xl, 16px);
  background: var(--dsw-specific-input-major, var(--dsw-alias-bg-layer-1));
  box-shadow: var(--dsw-shadow-lv2, 0 2px 8px rgba(0, 0, 0, 0.08));
  --dsh-scrollbar-thumb: var(--dsw-alias-scrollbar-bg-l2);
  --dsh-scrollbar-thumb-hover: var(--dsw-alias-scrollbar-hover-l2);
}
.dsh-s-approval-strip {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: var(--dsw-alias-state-warn-tertiary, rgba(255, 176, 32, 0.12));
  color: var(--dsw-alias-state-warn-primary);
  font-size: 13px;
  line-height: 18px;
}
.dsh-s-approval-dot {
  position: relative;
  display: inline-block;
  flex: none;
  width: 10px;
  height: 10px;
  color: var(--dsw-alias-state-warn-primary);
}
.dsh-s-approval-dot::after {
  content: '';
  position: absolute;
  inset: 20%;
  border-radius: 50%;
  background: currentColor;
}
.dsh-s-approval-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
  box-sizing: border-box;
  max-height: var(--dsh-composer-text-max-height, 40vh);
  overflow-y: auto;
  padding: 12px 16px 0;
}
.dsh-s-approval-headline {
  color: var(--dsw-alias-label-primary);
  font-size: 15px;
  font-weight: 500;
  line-height: 24px;
  word-break: break-word;
}
.dsh-s-approval-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 14px 16px;
  flex-wrap: wrap;
}
.dsh-s-approval-button {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 36px;
  padding: 0 14px;
  border: none;
  border-radius: var(--dsw-radius-md, 8px);
  cursor: pointer;
  font-family: inherit;
  font-size: 14px;
  line-height: 22px;
  color: var(--dsw-alias-label-primary);
  background: transparent;
}
.dsh-s-approval-button:disabled { cursor: not-allowed; opacity: 0.4; }
.dsh-s-approval-outline {
  border: 0.5px solid transparent;
  background: transparent;
  box-shadow: inset 0 0 0 var(--dsh-hairline-width, 0.5px) var(--dsh-button-outline-color, var(--dsw-alias-border-l3));
}
@media (hover: hover) {
  .dsh-s-approval-outline:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover); }
  .dsh-s-approval-reject:hover:not(:disabled) {
    background: var(--dsw-alias-interactive-bg-hover-danger);
    color: var(--dsw-alias-state-error-primary);
    --dsh-button-outline-color: transparent;
  }
}
.dsh-s-approval-primary {
  background: var(--dsw-alias-button-primary-fill);
  color: var(--dsw-alias-label-primary-foreground);
}
@media (hover: hover) {
  .dsh-s-approval-primary:hover:not(:disabled) { background: var(--dsw-alias-button-primary-hover); }
}
`

    function installStyle() {
      const existing = document.getElementById(STYLE_ID)
      if (existing !== null) {
        existing.textContent = CSS
        return () => {}
      }
      const element = document.createElement('style')
      element.id = STYLE_ID
      element.textContent = CSS
      document.head.append(element)
      return () => { element.remove() }
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

      const requestedReason = (() => {
        if (approval.displayReason !== undefined && props.resolveReason !== undefined) {
          return props.resolveReason(approval.displayReason)
        }
        return approval.reason
      })()
      const title = requestedReason !== undefined && requestedReason !== ''
        ? requestedReason
        : t('escalation', { toolName: String(approval.toolName) })

      return h('div', { className: 'dsh-s-approval-root' },
        h('div', {
          className: 'dsh-s-approval-card',
          'data-dsh-session-approval': 'card',
          'aria-busy': answered,
          onKeyDown,
        }, [
          h('div', { key: 'strip', className: 'dsh-s-approval-strip' }, [
            h('span', { key: 'dot', className: 'dsh-s-approval-dot', 'aria-hidden': true }),
            h('span', { key: 'label' }, t('waiting')),
          ]),
          h('div', {
            key: 'body',
            className: 'dsh-s-approval-body',
            role: 'group',
            tabIndex: 0,
            'aria-label': t('detailAria'),
          }, h('div', { className: 'dsh-s-approval-headline' }, title)),
          h('div', { key: 'actions', className: 'dsh-s-approval-actions' }, [
            h('button', {
              key: 'reject',
              type: 'button',
              disabled: answered,
              className: 'dsh-s-approval-button dsh-s-approval-outline dsh-s-approval-reject',
              onClick: () => { answer('rejected') },
            }, t('reject')),
            h('button', {
              key: 'once',
              type: 'button',
              disabled: answered,
              className: 'dsh-s-approval-button dsh-s-approval-outline',
              onClick: () => { answer('allowed-once') },
            }, t('allowOnce')),
            h('button', {
              key: 'session',
              type: 'button',
              disabled: answered,
              title: t('allowSessionHint'),
              className: 'dsh-s-approval-button dsh-s-approval-primary',
              onClick: grantConversation,
            }, t('allowSession')),
          ]),
        ]))
    }

    const zh = {
      waiting: '等待审批',
      detailAria: '审批详情',
      escalation: '工具 {toolName} 请求越权执行',
      reject: '拒绝',
      allowOnce: '允许一次',
      allowSession: '允许当前对话',
      allowSessionHint: '本轮后续的审批不再询问；本轮结束后会重新询问',
    }
    const en = {
      waiting: 'Waiting for approval',
      detailAria: 'Approval details',
      escalation: 'Tool {toolName} requests privileged execution',
      reject: 'Reject',
      allowOnce: 'Allow once',
      allowSession: 'Allow this conversation',
      allowSessionHint: 'Answers the rest of this turn without asking; the next turn asks again',
    }

    return {
      inject: ['slots', 'locale', 'remote'],
      apply(ctx) {
        ctx.effect(installStyle, 'dsh-session: stylesheet')
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
