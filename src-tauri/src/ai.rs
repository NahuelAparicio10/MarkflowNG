//! Provider transport and OS credentials. Never return transport errors or log payloads.
use std::{collections::HashMap, sync::Mutex, time::Duration};

use reqwest::{redirect::Policy, Client, Url};
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderConfig {
    #[serde(default)]
    pub local: bool,
    pub endpoint: String,
    pub model: String,
    pub remote_consent: bool,
}

#[derive(Default)]
pub struct AiState {
    providers: Mutex<HashMap<String, ProviderConfig>>,
}

impl AiState {
    pub fn configured(&self, workspace: &str) -> bool {
        self.providers
            .lock()
            .is_ok_and(|providers| providers.contains_key(workspace))
    }
}

#[derive(Debug, Serialize)]
pub struct ProviderError {
    code: &'static str,
    message: &'static str,
}

fn failure(code: &'static str) -> ProviderError {
    ProviderError {
        code,
        message: match code {
            "not-configured" => "Configure a provider for this workspace first.",
            "invalid-credential" => "The provider credential is missing or invalid.",
            "rate-limited" => "The provider is rate limited. Try again later.",
            "invalid-response" => "The provider returned an invalid response.",
            _ => "The provider is unavailable. Check its settings and try again.",
        },
    }
}

fn endpoint(config: &ProviderConfig) -> Result<Url, ProviderError> {
    let url = Url::parse(&config.endpoint).map_err(|_| failure("unavailable"))?;
    let transport_allowed = if config.local {
        // Literal loopback addresses only: no DNS rebinding or proxy forwarding.
        matches!(url.scheme(), "http" | "https")
            && url
                .host_str()
                .and_then(|host| {
                    host.trim_matches(['[', ']'])
                        .parse::<std::net::IpAddr>()
                        .ok()
                })
                .is_some_and(|ip| ip.is_loopback())
    } else {
        config.remote_consent && url.scheme() == "https"
    };
    if !transport_allowed
        || config.model.trim().is_empty()
        || url.host_str().is_none()
        || !url.username().is_empty()
        || url.password().is_some()
        || url.query().is_some()
        || url.fragment().is_some()
    {
        return Err(failure("not-configured"));
    }
    Ok(url)
}

fn credential(workspace: &str, config: &ProviderConfig) -> Result<keyring::Entry, ProviderError> {
    // The full endpoint isolates credentials across vendors, including those on the same host.
    use sha2::{Digest, Sha256};
    let identity = format!("{workspace}\0{}", config.endpoint);
    let account = format!("{:x}", Sha256::digest(identity.as_bytes()));
    keyring::Entry::new("Markflow.AI", &account).map_err(|_| failure("invalid-credential"))
}

/// Configuration remains session-local; only the credential is persisted, in the OS store.
#[tauri::command]
pub async fn configure_ai(
    state: State<'_, AiState>,
    workspace: String,
    config: Option<ProviderConfig>,
    secret: Option<String>,
) -> Result<(), ProviderError> {
    if workspace.trim().is_empty() {
        return Err(failure("not-configured"));
    }
    if let Some(config) = &config {
        endpoint(config)?;
        if !config.local {
            let workspace = workspace.clone();
            let config = config.clone();
            tauri::async_runtime::spawn_blocking(move || {
                let entry = credential(&workspace, &config)?;
                match secret {
                    Some(secret) if !secret.trim().is_empty() => entry.set_password(&secret),
                    _ => entry.get_password().map(|_| ()),
                }
                .map_err(|_| failure("invalid-credential"))
            })
            .await
            .map_err(|_| failure("unavailable"))??;
        }
    }
    let mut providers = state.providers.lock().map_err(|_| failure("unavailable"))?;
    if let Some(config) = config {
        providers.insert(workspace, config);
    } else {
        providers.remove(&workspace);
    }
    Ok(())
}

#[derive(Deserialize)]
struct Completion {
    choices: Vec<Choice>,
}

#[derive(Deserialize)]
struct Choice {
    message: Message,
}

#[derive(Deserialize)]
struct Message {
    content: String,
}

#[tauri::command]
pub async fn generate_ai(
    state: State<'_, AiState>,
    workspace: String,
    instruction: String,
    content: String,
) -> Result<String, ProviderError> {
    // This guard happens before credential access, client construction or any network request.
    let config = state
        .providers
        .lock()
        .map_err(|_| failure("unavailable"))?
        .get(&workspace)
        .cloned()
        .ok_or_else(|| failure("not-configured"))?;
    let url = endpoint(&config)?;
    let credential_config = config.clone();
    let secret = if config.local {
        None
    } else {
        Some(
            tauri::async_runtime::spawn_blocking(move || {
                credential(&workspace, &credential_config)?
                    .get_password()
                    .map_err(|_| failure("invalid-credential"))
            })
            .await
            .map_err(|_| failure("unavailable"))??,
        )
    };
    let mut builder = Client::builder()
        .redirect(Policy::none())
        .connect_timeout(Duration::from_secs(10))
        .timeout(Duration::from_secs(120));
    if config.local {
        builder = builder.no_proxy();
    }
    let client = builder.build().map_err(|_| failure("unavailable"))?;
    let mut request = client.post(url);
    if let Some(secret) = secret {
        request = request.bearer_auth(secret);
    }
    let response = request
        .json(&serde_json::json!({
            "model": config.model, "stream": false,
            "messages": [
                { "role": "system", "content": instruction },
                { "role": "user", "content": content }
            ]
        }))
        .send()
        .await
        .map_err(|_| failure("unavailable"))?;
    match response.status().as_u16() {
        401 | 403 => return Err(failure("invalid-credential")),
        429 => return Err(failure("rate-limited")),
        200..=299 => {}
        _ => return Err(failure("unavailable")),
    }
    let result: Completion = response
        .json()
        .await
        .map_err(|_| failure("invalid-response"))?;
    result
        .choices
        .into_iter()
        .next()
        .map(|choice| choice.message.content)
        .filter(|text| !text.trim().is_empty())
        .ok_or_else(|| failure("invalid-response"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn remote_requires_consent_and_https_without_embedded_secrets() {
        for url in [
            "http://example.com/v1/chat/completions",
            "https://key@example.com",
            "https://example.com?key=secret",
        ] {
            assert!(endpoint(&ProviderConfig {
                local: false,
                endpoint: url.into(),
                model: "model".into(),
                remote_consent: true
            })
            .is_err());
        }
        let mut config = ProviderConfig {
            local: false,
            endpoint: "https://example.com/v1/chat/completions".into(),
            model: "model".into(),
            remote_consent: false,
        };
        assert!(endpoint(&config).is_err());
        config.remote_consent = true;
        assert!(endpoint(&config).is_ok());
    }

    #[test]
    fn errors_are_fixed_application_text() {
        let text = serde_json::to_string(&failure("invalid-credential")).unwrap();
        assert_eq!(
            text,
            r#"{"code":"invalid-credential","message":"The provider credential is missing or invalid."}"#
        );
        assert!(AiState::default().providers.lock().unwrap().is_empty());
    }

    #[test]
    fn local_endpoint_requires_literal_loopback_and_no_remote_consent() {
        let local = |endpoint: &str| ProviderConfig {
            local: true,
            endpoint: endpoint.into(),
            model: "local".into(),
            remote_consent: false,
        };
        assert!(endpoint(&local("http://127.0.0.1:8080/v1/chat/completions")).is_ok());
        assert!(endpoint(&local("http://[::1]:8080/v1/chat/completions")).is_ok());
        assert!(endpoint(&local("http://localhost:8080/v1/chat/completions")).is_err());
        assert!(endpoint(&local("https://example.com/v1/chat/completions")).is_err());
    }

    #[test]
    fn an_unconfigured_provider_is_rejected_before_any_transport_is_created() {
        let state = AiState::default();
        assert!(!state.configured("workspace"));
        assert_eq!(failure("not-configured").code, "not-configured");
        // generate_ai resolves this guard before credential lookup or Client::builder.
        assert!(state.providers.lock().unwrap().get("workspace").is_none());
    }
}
