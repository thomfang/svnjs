svn_client_js
=============

A javascript lib use as a SVN client on web.

-------------


The lib supports follow SVN operations:

* svn add 
* svn rm (del, remove, delete)
* svn mkdir
* svn ps (propset, pset)
* svn pd (propdel, pdel)
* svn ci (commit)


*API*

<table>
  <tr>
    <th>name</th>
    <th>param</th>
    <th>type</th>
    <th>description</th>
  </tr>
  <tr>
    <td>add</td>
    <td>
      <p>file</p>
      <p>content</p>
    </td>
    <td>
      <p>string</p>
      <p>string</p>
    </td>
    <td>
      <p>the file to add</p>
      <p>text write into the file</p>
    </td>
  </tr>
  <tr>
    <td>del</td>
    <td>path</td>
    <td>string</td>
    <td>a file or a directory</td>
  </tr>
  <tr>
    <td>propset</td>
    <td>
      <p>file</p>
      <p>prop_json</p>
    </td>
    <td>
      <p>string</p>
      <p>json</p>
    </td>
    <td>
      <p>target file to set props</p>
      <p>props to set</p>
    </td>
  </tr>
  <tr>
    <td>propdel</td>
    <td>
      <p>file</p>
      <p>prop_array</p>
    </td>
    <td>
      <p>string</p>
      <p>array</p>
    </td>
    <td>
      <p>target file to del props</p>
      <p>props to del</p>
    </td>
  </tr>
  <tr>
    <td>mkdir</td>
    <td>dir_name</td>
    <td>string</td>
    <td>directory name</td>
  </tr>
  <tr>
    <td>commit</td>
    <td>summary</td>
    <td>string</td>
    <td>commit summary</td>
  </tr>
</table>

Example:

1.  Generate an instance:
    > var mysvn =  new SVN(usname, passwd, basepath);
       * usname: your SVN username
       * passwd: your SVN password

2.  Then do what you can & what you want, like:
    > mysvn.mkdir('my_dir');

    > mysvn.add('test.js', 'alert("done!");');

    > mysvn.propset('test.js', { 'mime-type': 'text/javscript' });

3.  The most important step:
    > mysvn.commit('Create a folder:my_dir and add a js file:test.js');

    If you do everything without this step,
    The request won't be sent.

Future will continue to support more operation command,
like move, copy, lock, unlock.
