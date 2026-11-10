import {test,expect} from 'vitest';
import {toNum,isBrandDomain,mentionsBrand} from './parseAliceXlsx';
test('x',()=>{
expect(toNum('1 234')).toBe(1234);expect(toNum('12\u00a0500')).toBe(12500);expect(toNum(77)).toBe(77);
expect(isBrandDomain('notren-cosm.ru','ren-cosm.ru')).toBe(false);expect(isBrandDomain('shop.ren-cosm.ru','ren-cosm.ru')).toBe(true);
expect(mentionsBrand('Продукция компании Ренессанс Косметика хороша','ренессанс косметик','ren-cosm.ru')).toBe(true);
expect(mentionsBrand('Купите на сайте ren-cosm','','ren-cosm.ru')).toBe(true);
expect(mentionsBrand('Лучшая косметика','ренессанс косметик','ren-cosm.ru')).toBe(false);
});
