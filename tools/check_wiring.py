"""Offline Terraform wiring check: every var.* is declared, every module input
exists in the module, every required module variable is passed, and every
module.X.Y output exists. Complements `terraform validate` when the registry
is unreachable."""
import glob, os, re, sys
import hcl2

q = lambda k: k.strip('"')

def load(d):
    r = {'variable': {}, 'output': {}, 'module': {}, 'text': ''}
    for f in glob.glob(d + '/*.tf'):
        t = open(f).read(); r['text'] += t
        x = hcl2.loads(t)
        for kind in ('variable', 'output', 'module'):
            for b in x.get(kind, []):
                for k, v in b.items():
                    r[kind][q(k)] = {q(a): c for a, c in v.items()} if isinstance(v, dict) else v
    return r

def check(d):
    r = load(d); errs = []
    for v in set(re.findall(r'\bvar\.([a-z_0-9]+)', r['text'])):
        if v not in r['variable']: errs.append(f'{d}: var.{v} undeclared')
    for name, m in r['module'].items():
        sub = load(os.path.normpath(os.path.join(d, q(m['source']))))
        args = {k for k in m if k not in ('source', 'count', 'for_each', 'depends_on', 'providers') and not k.startswith('__')}
        errs += [f'{d}: module {name} unknown input {a}' for a in args if a not in sub['variable']]
        errs += [f'{d}: module {name} missing {vn}' for vn, vb in sub['variable'].items() if 'default' not in vb and vn not in args]
        for o in set(re.findall(r'module\.' + name + r'(?:\[0\])?\.([a-z_0-9]+)', r['text'])):
            if o not in sub['output']: errs.append(f'{d}: module.{name}.{o} no such output')
    return errs

root = sys.argv[1] if len(sys.argv) > 1 else '.'
e = check(root)
for d in glob.glob(os.path.join(root, 'modules/*')): e += check(d)
print('\n'.join(e) or 'WIRING OK'); sys.exit(1 if e else 0)
