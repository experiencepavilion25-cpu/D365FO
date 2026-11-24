import { useEffect, useRef } from 'react';
import originHtml from './origin.html?raw';
import workflowRuntime from './workflow-legacy.js?raw';

function getTagContents(html, tagName) {
  const matches = [...html.matchAll(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'gi'))];
  return matches.map((match) => match[1]);
}

export default function App() {
  const rootRef = useRef(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const bodyMatch = originHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    let markup = bodyMatch ? bodyMatch[1] : originHtml;
    markup = markup.replace(
      '<option value="masters">Masters Entry Sheet</option>',
      '<option value="masters">Masters Entry Sheet</option><option value="workflow">Workflow</option>',
    );
    markup = markup.replace(
      `<a class="tab" href="#masters" data-tab="masters" onclick="showTab('masters',this)">Masters Entry Sheet</a>`,
      `<a class="tab" href="#masters" data-tab="masters" onclick="showTab('masters',this)">Masters Entry Sheet</a><a class="tab" href="#workflow" data-tab="workflow" onclick="showTab('workflow',this)">Workflow</a>`,
    );
    root.innerHTML = markup;

    const titleMatch = originHtml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (titleMatch) {
      document.title = titleMatch[1].replace(/â€”/g, '—').replace(/â†’/g, '→');
    }

    const styleNodes = [];
    getTagContents(originHtml, 'style').forEach((css) => {
      const style = document.createElement('style');
      style.textContent = css;
      document.head.appendChild(style);
      styleNodes.push(style);
    });

    const scriptNodes = getTagContents(originHtml, 'script').map((code) => {
      const script = document.createElement('script');
      script.textContent = code;
      document.body.appendChild(script);
      return script;
    });

    const workflowScript = document.createElement('script');
    workflowScript.textContent = workflowRuntime;
    document.body.appendChild(workflowScript);

    const tabs = [...root.querySelectorAll('.tab[data-tab]')];
    const activateCurrentTab = () => {
      const requestedTabId = window.location.hash.slice(1);
      const tab =
        tabs.find((candidate) => candidate.dataset.tab === requestedTabId) ||
        root.querySelector('[data-tab="pcoa"]') ||
        tabs[0];
      if (tab && typeof window.showTab === 'function') {
        window.showTab(tab.dataset.tab, tab);
      }
    };
    const activateTabFromHash = () => {
      const requestedTabId = window.location.hash.slice(1);
      const tab = tabs.find((candidate) => candidate.dataset.tab === requestedTabId);
      if (tab && typeof window.showTab === 'function') {
        window.showTab(tab.dataset.tab, tab);
      }
    };
    activateCurrentTab();
    window.addEventListener('hashchange', activateTabFromHash);
    const initialTabFrame = window.requestAnimationFrame(activateCurrentTab);

    const configModules = [
      'Organization administration',
      'General ledger',
      'Accounts payable',
      'Accounts receivable',
      'Cash and bank management',
      'Budgeting',
      'Fixed assets',
      'Tax',
      'Cost accounting',
      'Inventory management',
      'Procurement and sourcing',
      'Sales and marketing',
      'Product information management',
      'Warehouse management',
      'Transportation management',
      'Master planning',
      'Production control',
      'Project management and accounting',
      'Human resources',
      'Payroll',
      'Service management',
      'Asset management',
      'Subscription billing',
      'Commerce / Retail',
      'Supply Chain',
      'Financial reporting',
      'Workflow',
      'Security / System administration',
      'Data management / Integration',
      'Business intelligence / Reporting',
      'Mobile / Field service',
    ];
    const configModuleSelect = root.querySelector('#smbModule');
    const updateConfigModules = () => {
      if (!configModuleSelect) return;
      const currentValue = configModuleSelect.value;
      configModuleSelect.innerHTML =
        '<option>All Modules — Show All Module Details</option>' +
        configModules.map((moduleName) => `<option>${moduleName.replace(/&/g, '&amp;')}</option>`).join('');
      configModuleSelect.value =
        currentValue.startsWith('All Modules') || configModules.includes(currentValue)
          ? currentValue
          : 'Accounts payable';
    };
    updateConfigModules();
    const configVertical = root.querySelector('#smbVertical');
    const refreshConfigModules = () => {
      updateConfigModules();
      if (typeof window.smbRender === 'function') window.smbRender();
    };
    if (configVertical && !configVertical.dataset.qsCfgFixed) {
      configVertical.dataset.qsCfgFixed = '1';
      configVertical.addEventListener('change', refreshConfigModules);
    }
    if (typeof window.smbRender === 'function') window.smbRender();

    const handleExternalLink = (anchor) => {
      const href = anchor.getAttribute('href');
      if (!href) return;
      try {
        const url = new URL(href, document.baseURI);
        if (
          ((url.protocol === 'http:' || url.protocol === 'https:') && url.host !== window.location.host) ||
          ['mailto:', 'tel:', 'sms:'].includes(url.protocol)
        ) {
          anchor.target = '_blank';
          anchor.rel = 'noopener noreferrer';
        }
      } catch {
        return;
      }
    };
    root.querySelectorAll('a[href]').forEach(handleExternalLink);
    const handleDocumentClick = (event) => {
      const anchor = event.target && event.target.closest && event.target.closest('a[href]');
      if (anchor) handleExternalLink(anchor);
    };
    document.addEventListener('click', handleDocumentClick, true);

    return () => {
      styleNodes.forEach((node) => node.remove());
      scriptNodes.forEach((node) => node.remove());
      workflowScript.remove();
      window.removeEventListener('hashchange', activateTabFromHash);
      window.cancelAnimationFrame(initialTabFrame);
      document.removeEventListener('click', handleDocumentClick, true);
    };
  }, []);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--surface)',
        color: 'var(--ink)',
        paddingTop: 'var(--safe-area-inset-top)',
        boxSizing: 'border-box',
      }}
    >
      <div id="app-content" ref={rootRef} style={{ overflowX: 'clip' }} />
    </div>
  );
}
