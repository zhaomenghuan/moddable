/*
 * Copyright (c) 2016-2017  Moddable Tech, Inc.
 *
 *   This file is part of the Moddable SDK Runtime.
 * 
 *   The Moddable SDK Runtime is free software: you can redistribute it and/or modify
 *   it under the terms of the GNU Lesser General Public License as published by
 *   the Free Software Foundation, either version 3 of the License, or
 *   (at your option) any later version.
 * 
 *   The Moddable SDK Runtime is distributed in the hope that it will be useful,
 *   but WITHOUT ANY WARRANTY; without even the implied warranty of
 *   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *   GNU Lesser General Public License for more details.
 * 
 *   You should have received a copy of the GNU Lesser General Public License
 *   along with the Moddable SDK Runtime.  If not, see <http://www.gnu.org/licenses/>.
 *
 * This file incorporates work covered by the following copyright and  
 * permission notice:  
 *
 *       Copyright (C) 2010-2016 Marvell International Ltd.
 *       Copyright (C) 2002-2010 Kinoma, Inc.
 *
 *       Licensed under the Apache License, Version 2.0 (the "License");
 *       you may not use this file except in compliance with the License.
 *       You may obtain a copy of the License at
 *
 *        http://www.apache.org/licenses/LICENSE-2.0
 *
 *       Unless required by applicable law or agreed to in writing, software
 *       distributed under the License is distributed on an "AS IS" BASIS,
 *       WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *       See the License for the specific language governing permissions and
 *       limitations under the License.
 */

import Crypt from "crypt";
import PKCS1 from "pkcs1";
import Mont from "mont";
import EC from "ec";

export default class ECDSA {
	constructor(key, priv) {
		this.u = priv ? key.du: key.Qu;
		this.G = key.G;
		this.orderSize = (BigInt.bitLength(key.n) + 7) >>> 3;
		this.n = new Mont({m: key.n});
		this.ec = new EC(key.a, key.b, key.p);
		this.k = key.k;		// just for the debugging purpose
	};
	_sign(H) {
		// (r, s) = (k*G, (e + du*r) / k)
		var ec = this.ec;
		var du = this.u;
		var G = this.G;
		var n = this.n;
		var e = BigInt.fromArrayBuffer(H);
		do {
			var k = this.k;
			if (!k)
				var k = this.randint(n.m);
			var R = ec.mul(G, k);
			var r = R.X;
			var s = n.mul(n.add(e, n.mul(du, r)), n.mulinv(k));
		} while (s == 0);
		var sig = new Object;
		sig.r = r;
		sig.s = s;
		return sig;
	};
	sign(H) {
		var sig = this._sign(H);
		var os = new ArrayBuffer();
		var l = this.orderSize;
		return os.concat(PKCS1.I2OSP(sig.r, l), PKCS1.I2OSP(sig.s, l));
	};
	_verify(H, r, s) {
		// u1 = e / s
		// u2 = r / s
		// R = u1*G + u2*Qu
		// result = R.x == r
		var ec = this.ec;
		var Qu = this.u;
		var G = this.G;
		var n = this.n;
		var e = BigInt.fromArrayBuffer(H);
		var s_inv = n.mulinv(s);
		var u1 = n.mul(e, s_inv);
		var u2 = n.mul(r, s_inv);
		// var R = ec.add(ec.mul(G, u1), ec.mul(Qu, u2));
		var R = ec.mul2(G, u1, Qu, u2);
		return R.X.comp(r) == 0;
	};
	verify(H, sig) {
		var l = this.orderSize;
		var r = PKCS1.OS2IP(sig.slice(0, l));
		var s = PKCS1.OS2IP(sig.slice(l, l*2));
		return this._verify(H, r, s);
	};
	static randint(max) {
		var i = BigInt.fromArrayBuffer(Crypt.rng(BigInt.bitLength(max) >>> 3));
		while (i >= max)
			i >>>= 1;
		return i;
	};
};
