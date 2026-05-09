const SENSITIVE_PATTERNS = [
  {
    name: 'id_card_cn',
    pattern: /[1-9]\d{5}(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[\dXx]/g,
    label: 'ID_CARD'
  },
  {
    name: 'bank_account',
    pattern: /\b\d{16,19}\b/g,
    label: 'BANK_ACCOUNT'
  },
  {
    name: 'passport_cn',
    pattern: /[EGD]\d{8}/g,
    label: 'PASSPORT'
  },
  {
    name: 'phone_cn',
    pattern: /1[3-9]\d{9}/g,
    label: 'PHONE'
  },
  {
    name: 'amount_large',
    pattern: /[$￥€£]\s?\d{1,3}(?:[,，]\d{3})*(?:\.\d{1,2})?\s?(?:万|亿|million|billion)?/g,
    label: 'AMOUNT'
  }
];

function desensitize(text) {
  const mapping = {};
  let counter = 0;
  let result = text;

  for (const { name, pattern, label } of SENSITIVE_PATTERNS) {
    result = result.replace(pattern, (match) => {
      const key = `[${label}_${++counter}]`;
      mapping[key] = match;
      return key;
    });
  }

  return { text: result, mapping };
}

function restore(text, mapping) {
  let result = text;
  for (const [key, value] of Object.entries(mapping)) {
    result = result.replace(new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
  }
  return result;
}

module.exports = { desensitize, restore };
