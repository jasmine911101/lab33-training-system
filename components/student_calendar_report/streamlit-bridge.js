(function () {
  const ComponentMessageType = {
    COMPONENT_READY: "streamlit:componentReady",
    SET_COMPONENT_VALUE: "streamlit:setComponentValue",
    SET_FRAME_HEIGHT: "streamlit:setFrameHeight",
  }

  function injectTheme(theme) {
    const style = document.createElement("style")
    document.head.appendChild(style)
    style.innerHTML = `
      :root {
        --primary-color: ${theme.primaryColor};
        --background-color: ${theme.backgroundColor};
        --secondary-background-color: ${theme.secondaryBackgroundColor};
        --text-color: ${theme.textColor};
        --font: ${theme.font};
      }

      body {
        background-color: var(--background-color);
        color: var(--text-color);
      }
    `
  }

  const Streamlit = {
    API_VERSION: 1,
    RENDER_EVENT: "streamlit:render",
    events: new EventTarget(),
    registeredMessageListener: false,
    lastFrameHeight: undefined,

    setComponentReady() {
      if (!Streamlit.registeredMessageListener) {
        window.addEventListener("message", Streamlit.onMessageEvent)
        Streamlit.registeredMessageListener = true
      }
      Streamlit.sendBackMsg(ComponentMessageType.COMPONENT_READY, {
        apiVersion: Streamlit.API_VERSION,
      })
    },

    setFrameHeight(height) {
      const nextHeight = height === undefined ? document.body.scrollHeight : height
      if (nextHeight === Streamlit.lastFrameHeight) {
        return
      }
      Streamlit.lastFrameHeight = nextHeight
      Streamlit.sendBackMsg(ComponentMessageType.SET_FRAME_HEIGHT, {
        height: nextHeight,
      })
    },

    setComponentValue(value) {
      Streamlit.sendBackMsg(ComponentMessageType.SET_COMPONENT_VALUE, {
        value,
        dataType: "json",
      })
    },

    onMessageEvent(event) {
      const type = event.data && event.data.type
      if (type === Streamlit.RENDER_EVENT) {
        Streamlit.onRenderMessage(event.data)
      }
    },

    onRenderMessage(data) {
      let args = data.args
      if (args == null) {
        console.error("Got null args in onRenderMessage. This should never happen")
        args = {}
      }
      const disabled = Boolean(data.disabled)
      const theme = data.theme
      if (theme) {
        injectTheme(theme)
      }
      const eventObject = new CustomEvent(Streamlit.RENDER_EVENT, {
        detail: { disabled, args, theme },
      })
      Streamlit.events.dispatchEvent(eventObject)
    },

    sendBackMsg(type, data) {
      window.parent.postMessage(
        {
          isStreamlitMessage: true,
          type,
          ...data,
        },
        "*"
      )
    },
  }

  window.Streamlit = Streamlit
})()
